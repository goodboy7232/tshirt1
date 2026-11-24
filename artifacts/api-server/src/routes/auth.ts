import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import initSqlJs, { type Database } from "sql.js";
import { Router, type NextFunction, type Request, type Response } from "express";

const router = Router();
const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "bb_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const authAttempts = new Map<string, number[]>();
const require = createRequire(import.meta.url);
const sqlJsEntry = require.resolve("sql.js");
const dataDirectory = path.resolve(process.env.AUTH_DATA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../data"));
const databasePath = path.join(dataDirectory, "accounts.sqlite");
mkdirSync(dataDirectory, { recursive: true });

const SQL = await initSqlJs({ locateFile: () => path.join(path.dirname(sqlJsEntry), "sql-wasm.wasm") });
const database: Database = (() => {
  try {
    return new SQL.Database(readFileSync(databasePath));
  } catch {
    return new SQL.Database();
  }
})();
database.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saved_designs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    items_json TEXT NOT NULL,
    address_json TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    total INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'full',
    payment_due INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    proof_data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at);
  CREATE TABLE IF NOT EXISTS bulk_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
`);
try { database.run("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'full'"); } catch { /* Existing database already has this column. */ }
try { database.run("ALTER TABLE orders ADD COLUMN payment_due INTEGER NOT NULL DEFAULT 0"); } catch { /* Existing database already has this column. */ }
database.run("UPDATE orders SET payment_due = total WHERE payment_due = 0");

function persistDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  writeFileSync(temporaryPath, Buffer.from(database.export()));
  renameSync(temporaryPath, databasePath);
}
persistDatabase();

type PublicUser = { id: string; email: string; role: string; createdAt: string };
type UserRow = { id: string; email: string; password_hash: string; role: string; created_at: string };

function getRow<T extends object>(sql: string, values: unknown[] = []): T | undefined {
  const statement = database.prepare(sql);
  try {
    statement.bind(values as (string | number | null | Uint8Array)[]);
    return statement.step() ? statement.getAsObject() as T : undefined;
  } finally {
    statement.free();
  }
}

function allRows<T extends object>(sql: string, values: unknown[] = []): T[] {
  const statement = database.prepare(sql);
  try {
    statement.bind(values as (string | number | null | Uint8Array)[]);
    const result: T[] = [];
    while (statement.step()) result.push(statement.getAsObject() as T);
    return result;
  } finally {
    statement.free();
  }
}

function run(sql: string, values: unknown[] = []) {
  database.run(sql, values as (string | number | null | Uint8Array)[]);
  persistDatabase();
}

function publicUser(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.created_at };
}

function cookieToken(request: Request) {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : undefined;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function createSession(user: UserRow, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  run("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [tokenHash(token), user.id, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now]);
  setSessionCookie(response, token);
  return publicUser(user);
}

function currentUser(request: Request) {
  const token = cookieToken(request);
  if (!token) return undefined;
  const user = getRow<UserRow>(
    "SELECT users.id, users.email, users.password_hash, users.role, users.created_at FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.id = ? AND sessions.expires_at > ?",
    [tokenHash(token), new Date().toISOString()],
  );
  return user;
}

const productPrices: Record<string, number> = {
  "regular-white": 220,
  "regular-black": 220,
  "oversized-black": 280,
  "oversized-red": 280,
  "v-neck-cream": 240,
  "polo-white": 320,
  "polo-navy": 320,
  "polo-green": 320,
};
const allowedSizes = new Set(["XS", "S", "M", "L", "XL", "2XL"]);
type DesignConfig = {
  productId: string;
  color: string;
  placement: "none" | "front" | "back" | "both" | "sides" | "all" | "custom";
  printSides: ("front" | "back" | "left" | "right")[];
  elow: "none" | "one" | "two";
  frontText: string;
  backText: string;
  leftText: string;
  rightText: string;
  size: string;
  quantity: number;
  artwork: string | null;
  backArtwork: string | null;
  leftArtwork: string | null;
  rightArtwork: string | null;
  frontDocument: string | null;
  backDocument: string | null;
  leftDocument: string | null;
  rightDocument: string | null;
};

function normalizedArtwork(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 5_600_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
  const encoded = value.split(",")[1] ?? "";
  if (Buffer.from(encoded, "base64").byteLength > 4 * 1024 * 1024) return undefined;
  const actualType = encoded.startsWith("iVBORw0KGgo") ? "png" : encoded.startsWith("/9j/") ? "jpeg" : encoded.startsWith("UklGR") ? "webp" : "unknown";
  return actualType === value.match(/^data:image\/(png|jpeg|webp);base64,/)?.[1] ? value : undefined;
}

function normalizedDocument(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 8 * 1024 * 1024) return undefined;
  try {
    const document = JSON.parse(value) as { objects?: unknown[] };
    return Array.isArray(document.objects) && document.objects.length <= 120 ? value : undefined;
  } catch {
    return undefined;
  }
}

function normalizedConfig(value: unknown): DesignConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const config = value as Record<string, unknown>;
  if (typeof config.productId !== "string" || !productPrices[config.productId]) return undefined;
  if (typeof config.color !== "string" || !/^#[0-9a-f]{6}$/i.test(config.color)) return undefined;
  if (!(config.placement === "none" || config.placement === "front" || config.placement === "back" || config.placement === "both" || config.placement === "sides" || config.placement === "all" || config.placement === "custom")) return undefined;
  if (!(config.elow === "none" || config.elow === "one" || config.elow === "two")) return undefined;
  if (typeof config.size !== "string" || !allowedSizes.has(config.size)) return undefined;
  if (typeof config.quantity !== "number" || !Number.isInteger(config.quantity) || config.quantity < 1 || config.quantity > 9) return undefined;
  const frontText = typeof config.frontText === "string" ? config.frontText.trim().slice(0, 24) : "";
  const backText = typeof config.backText === "string" ? config.backText.trim().slice(0, 24) : "";
  const leftText = typeof config.leftText === "string" ? config.leftText.trim().slice(0, 24) : "";
  const rightText = typeof config.rightText === "string" ? config.rightText.trim().slice(0, 24) : "";
  const artwork = normalizedArtwork(config.artwork);
  const backArtwork = normalizedArtwork(config.backArtwork);
  const leftArtwork = normalizedArtwork(config.leftArtwork);
  const rightArtwork = normalizedArtwork(config.rightArtwork);
  const frontDocument = normalizedDocument(config.frontDocument);
  const backDocument = normalizedDocument(config.backDocument);
  const leftDocument = normalizedDocument(config.leftDocument);
  const rightDocument = normalizedDocument(config.rightDocument);
  if ([artwork, backArtwork, leftArtwork, rightArtwork].includes(undefined) || [frontDocument, backDocument, leftDocument, rightDocument].includes(undefined)) return undefined;
  const validSides = ["front", "back", "left", "right"] as const;
  const legacySides: (typeof validSides)[number][] = config.placement === "front" ? ["front"] : config.placement === "back" ? ["back"] : config.placement === "both" ? ["front", "back"] : config.placement === "sides" ? ["left", "right"] : config.placement === "all" ? [...validSides] : [];
  const printSides = Array.isArray(config.printSides)
    ? [...new Set(config.printSides.filter((side): side is (typeof validSides)[number] => validSides.includes(side as (typeof validSides)[number])))]
    : legacySides;
  if (Array.isArray(config.printSides) && (printSides.length !== config.printSides.length || printSides.length > 4)) return undefined;
  const sideContent: Record<(typeof validSides)[number], boolean> = {
    front: Boolean(artwork || frontText), back: Boolean(backArtwork || backText),
    left: Boolean(leftArtwork || leftText), right: Boolean(rightArtwork || rightText),
  };
  if (validSides.some((side) => sideContent[side] && !printSides.includes(side))) return undefined;
  return { productId: config.productId, color: config.color, placement: config.placement, printSides, elow: config.elow, frontText, backText, leftText, rightText, size: config.size, quantity: config.quantity, artwork: artwork ?? null, backArtwork: backArtwork ?? null, leftArtwork: leftArtwork ?? null, rightArtwork: rightArtwork ?? null, frontDocument: frontDocument ?? null, backDocument: backDocument ?? null, leftDocument: leftDocument ?? null, rightDocument: rightDocument ?? null };
}

function quoteLine(config: DesignConfig) {
  const sides = config.printSides ?? (config.placement === "front" ? ["front"] : config.placement === "back" ? ["back"] : config.placement === "both" ? ["front", "back"] : config.placement === "sides" ? ["left", "right"] : config.placement === "all" ? ["front", "back", "left", "right"] : []);
  const frontBackOnly = sides.length === 2 && sides.includes("front") && sides.includes("back");
  const allSides = sides.length === 4;
  const print = allSides ? 300 : frontBackOnly ? 200 : sides.reduce((total, side) => total + (side === "left" || side === "right" ? 80 : 120), 0);
  const elow = { none: 0, one: 50, two: 50 }[config.elow];
  const text = [config.frontText, config.backText, config.leftText, config.rightText].filter(Boolean).length * 50;
  const unitPrice = productPrices[config.productId] + print + elow + text;
  return { config, unitPrice, lineTotal: unitPrice * config.quantity };
}

function signedIn(request: Request, response: Response) {
  const user = currentUser(request);
  if (!user) {
    response.status(401).json({ error: "Please sign in to continue." });
    return undefined;
  }
  return user;
}

function adminOnly(request: Request, response: Response) {
  const user = signedIn(request, response);
  if (user && user.role !== "admin") {
    response.status(403).json({ error: "Administrator access required." });
    return undefined;
  }
  return user;
}

function limitAuthAttempts(request: Request, response: Response, next: NextFunction) {
  const key = request.ip ?? "unknown";
  const cutoff = Date.now() - AUTH_WINDOW_MS;
  const recentAttempts = (authAttempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recentAttempts.length >= 10) {
    response.setHeader("Retry-After", "900");
    response.status(429).json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." });
    return;
  }
  recentAttempts.push(Date.now());
  authAttempts.set(key, recentAttempts);
  next();
}

function orderRecord(row: Record<string, unknown>) {
  const storedItems = JSON.parse(String(row.items_json)) as ReturnType<typeof quoteLine>[];
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    items: storedItems.map((item) => ({ ...item, config: { ...item.config, hasArtwork: Boolean(item.config.artwork), hasBackArtwork: Boolean(item.config.backArtwork), hasLeftArtwork: Boolean(item.config.leftArtwork), hasRightArtwork: Boolean(item.config.rightArtwork), artwork: null, backArtwork: null, leftArtwork: null, rightArtwork: null, frontDocument: null, backDocument: null, leftDocument: null, rightDocument: null } })),
    address: JSON.parse(String(row.address_json)) as Record<string, string>,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    paymentMethod: row.payment_method ?? "full",
    paymentDue: row.payment_due ?? row.total,
    status: row.status,
    paymentStatus: row.payment_status,
    hasProof: Boolean(row.proof_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createUser(email: string, password: string, role = "customer"): Promise<UserRow> {
  const user: UserRow = { id: randomUUID(), email, password_hash: await passwordHash(password), role, created_at: new Date().toISOString() };
  run("INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)", [user.id, user.email, user.password_hash, user.role, user.created_at]);
  return user;
}

router.post("/auth/signup", limitAuthAttempts, async (request, response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = request.body?.password;
  if (!validEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    response.status(400).json({ error: "Enter a valid email and a password between 8 and 128 characters." });
    return;
  }
  if (getRow("SELECT id FROM users WHERE email = ?", [email])) {
    response.status(409).json({ error: "An account with this email already exists. Please log in." });
    return;
  }
  const user = await createUser(email, password);
  response.status(201).json({ user: createSession(user, response) });
});

router.post("/auth/login", limitAuthAttempts, async (request, response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = request.body?.password;
  if (!validEmail(email) || typeof password !== "string") {
    response.status(400).json({ error: "Enter your email and password." });
    return;
  }
  const user = getRow<UserRow>("SELECT * FROM users WHERE email = ?", [email]);
  if (!user || !(await passwordMatches(password, user.password_hash))) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  response.json({ user: createSession(user, response) });
});

router.get("/auth/me", (request, response) => {
  const user = currentUser(request);
  response.json({ user: user ? publicUser(user) : null });
});

router.post("/auth/logout", (request, response) => {
  const token = cookieToken(request);
  if (token) run("DELETE FROM sessions WHERE id = ?", [tokenHash(token)]);
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  response.json({ ok: true });
});

router.post("/admin/bootstrap", async (request, response) => {
  if (process.env.NODE_ENV === "production" && process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") {
    response.status(404).json({ error: "Not found." });
    return;
  }
  const configuredToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const suppliedToken = request.get("x-admin-bootstrap-token") ?? "";
  const expectedToken = configuredToken ? Buffer.from(configuredToken) : Buffer.alloc(0);
  const providedToken = Buffer.from(suppliedToken);
  if (!configuredToken || providedToken.length !== expectedToken.length || !timingSafeEqual(providedToken, expectedToken)) {
    response.status(404).json({ error: "Not found." });
    return;
  }
  limitAuthAttempts(request, response, () => undefined);
  if (response.headersSent) return;
  if (getRow("SELECT id FROM users WHERE role = 'admin'")) {
    response.status(409).json({ error: "An administrator is already configured." });
    return;
  }
  database.run("BEGIN IMMEDIATE");
  if (getRow("SELECT id FROM users WHERE role = 'admin'")) {
    database.run("ROLLBACK");
    response.status(409).json({ error: "An administrator is already configured." });
    return;
  }
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = request.body?.password;
  if (!validEmail(email) || typeof password !== "string" || password.length < 16 || password.length > 128) {
    database.run("ROLLBACK");
    response.status(400).json({ error: "Enter a valid email and an administrator password of 16–128 characters." });
    return;
  }
  if (getRow("SELECT id FROM users WHERE email = ?", [email])) {
    database.run("ROLLBACK");
    response.status(409).json({ error: "This email is already registered. Use an unused email for initial setup." });
    return;
  }
  try {
    const user: UserRow = { id: randomUUID(), email, password_hash: await passwordHash(password), role: "admin", created_at: new Date().toISOString() };
    database.run("INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)", [user.id, user.email, user.password_hash, user.role, user.created_at]);
    database.run("COMMIT");
    persistDatabase();
    response.status(201).json({ user: createSession(user, response) });
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
});

router.get("/admin/overview", (request, response) => {
  const user = currentUser(request);
  if (!user) {
    response.status(401).json({ error: "Sign in required." });
    return;
  }
  if (user.role !== "admin") {
    response.status(403).json({ error: "Administrator access required." });
    return;
  }
  response.json({ user: publicUser(user), message: "Admin access verified." });
});

router.get("/cart", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const items = allRows<{ id: string; config_json: string }>("SELECT id, config_json FROM cart_items WHERE user_id = ? ORDER BY created_at", [user.id]);
  response.json({ items: items.map((item) => ({ id: item.id, ...quoteLine(JSON.parse(item.config_json) as DesignConfig) })) });
});

router.post("/cart", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const config = normalizedConfig(request.body?.config);
  if (!config) {
    response.status(400).json({ error: "This design is incomplete or invalid. Please check product, size and artwork." });
    return;
  }
  const id = randomUUID();
  run("INSERT INTO cart_items (id, user_id, config_json, created_at) VALUES (?, ?, ?, ?)", [id, user.id, JSON.stringify(config), new Date().toISOString()]);
  response.status(201).json({ item: { id, ...quoteLine(config) } });
});

router.delete("/cart", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  run("DELETE FROM cart_items WHERE user_id = ?", [user.id]);
  response.json({ ok: true });
});

router.delete("/cart/:itemId", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  run("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [request.params.itemId, user.id]);
  response.json({ ok: true });
});

router.get("/designs", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const designs = allRows<{ id: string; title: string; config_json: string; created_at: string }>("SELECT id, title, config_json, created_at FROM saved_designs WHERE user_id = ? ORDER BY created_at DESC", [user.id]);
  response.json({ designs: designs.map((design) => ({ id: design.id, title: design.title, config: JSON.parse(design.config_json), createdAt: design.created_at })) });
});

router.post("/designs", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const config = normalizedConfig(request.body?.config);
  const title = typeof request.body?.title === "string" ? request.body.title.trim().slice(0, 80) : "";
  if (!config || !title) {
    response.status(400).json({ error: "A valid design and title are required." });
    return;
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  run("INSERT INTO saved_designs (id, user_id, title, config_json, created_at) VALUES (?, ?, ?, ?, ?)", [id, user.id, title, JSON.stringify(config), createdAt]);
  response.status(201).json({ design: { id, title, config, createdAt } });
});

router.delete("/designs/:designId", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  run("DELETE FROM saved_designs WHERE id = ? AND user_id = ?", [request.params.designId, user.id]);
  response.json({ ok: true });
});

router.post("/orders", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const address = request.body?.address;
  const paymentMethod = request.body?.paymentMethod;
  if (paymentMethod !== "full" && paymentMethod !== "booking") {
    response.status(400).json({ error: "Choose full payment or the ₹100 booking option." });
    return;
  }
  const required = ["name", "phone", "line1", "city", "state", "pincode"];
  if (!address || typeof address !== "object" || required.some((key) => typeof address[key] !== "string" || !address[key].trim() || address[key].length > 160) || !/^[6-9]\d{9}$/.test(address.phone) || !/^\d{6}$/.test(address.pincode)) {
    response.status(400).json({ error: "Enter a complete Indian delivery address, valid 10-digit mobile number and 6-digit PIN code." });
    return;
  }
  const cart = allRows<{ id: string; config_json: string }>("SELECT id, config_json FROM cart_items WHERE user_id = ? ORDER BY created_at", [user.id]);
  if (!cart.length) {
    response.status(400).json({ error: "Your bag is empty." });
    return;
  }
  let items: ReturnType<typeof quoteLine>[];
  try {
    items = cart.map((item) => {
      const config = normalizedConfig(JSON.parse(item.config_json));
      if (!config) throw new Error("Invalid saved cart item");
      return quoteLine(config);
    });
  } catch {
    response.status(400).json({ error: "A bag item is no longer valid. Remove it and add the design again." });
    return;
  }
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const shipping = subtotal > 500 ? 0 : 60;
  const total = subtotal + shipping;
  const paymentDue = paymentMethod === "booking" ? 100 : total;
  const id = randomUUID();
  const orderNumber = `BB-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${id.slice(0, 5).toUpperCase()}`;
  const now = new Date().toISOString();
  const orderItems = items.map((item) => ({ ...item, config: { ...item.config, frontDocument: null, backDocument: null, leftDocument: null, rightDocument: null } }));
  const safeAddress = Object.fromEntries(required.map((key) => [key, String(address[key]).trim()]));
  run("INSERT INTO orders (id, order_number, user_id, items_json, address_json, subtotal, shipping, total, payment_method, payment_due, status, payment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, orderNumber, user.id, JSON.stringify(orderItems), JSON.stringify(safeAddress), subtotal, shipping, total, paymentMethod, paymentDue, "awaiting_payment", "unverified", now, now]);
  run("DELETE FROM cart_items WHERE user_id = ?", [user.id]);
  response.status(201).json({ order: { id, orderNumber, items: orderItems.map((item) => ({ ...item, config: { ...item.config, hasArtwork: Boolean(item.config.artwork), hasBackArtwork: Boolean(item.config.backArtwork), hasLeftArtwork: Boolean(item.config.leftArtwork), hasRightArtwork: Boolean(item.config.rightArtwork), artwork: null, backArtwork: null, leftArtwork: null, rightArtwork: null } })), address: safeAddress, subtotal, shipping, total, paymentMethod, paymentDue, status: "awaiting_payment", paymentStatus: "unverified", hasProof: false, createdAt: now } });
});

router.post("/orders/:orderId/proof", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const order = getRow<{ id: string; status: string }>("SELECT id, status FROM orders WHERE id = ? AND user_id = ?", [request.params.orderId, user.id]);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.status !== "awaiting_payment") {
    response.status(409).json({ error: "This order is not awaiting a payment screenshot." });
    return;
  }
  const dataUrl = request.body?.dataUrl;
  if (typeof dataUrl !== "string" || dataUrl.length > 5_600_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl) || Buffer.from(dataUrl.split(",")[1] ?? "", "base64").byteLength > 4 * 1024 * 1024) {
    response.status(400).json({ error: "Upload a PNG, JPG or WebP payment screenshot under 4 MB." });
    return;
  }
  const encoded = dataUrl.split(",")[1] ?? "";
  const detectedType = encoded.startsWith("iVBORw0KGgo") ? "png" : encoded.startsWith("/9j/") ? "jpeg" : encoded.startsWith("UklGR") ? "webp" : "unknown";
  if (detectedType !== dataUrl.match(/^data:image\/(png|jpeg|webp);base64,/)?.[1]) {
    response.status(400).json({ error: "The uploaded file is not a valid PNG, JPG or WebP screenshot." });
    return;
  }
  const now = new Date().toISOString();
  run("UPDATE orders SET proof_data = ?, status = 'payment_review', payment_status = 'proof_submitted', updated_at = ? WHERE id = ?", [dataUrl, now, order.id]);
  response.json({ ok: true, status: "payment_review" });
});

router.get("/orders", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const rows = allRows<Record<string, unknown>>("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [user.id]);
  response.json({ orders: rows.map(orderRecord) });
});

router.get("/orders/:orderId", (request, response) => {
  const user = signedIn(request, response);
  if (!user) return;
  const row = getRow<Record<string, unknown>>("SELECT * FROM orders WHERE id = ? AND user_id = ?", [request.params.orderId, user.id]);
  if (!row) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  response.json({ order: orderRecord(row) });
});

router.get("/admin/orders", (request, response) => {
  if (!adminOnly(request, response)) return;
  const rows = allRows<Record<string, unknown>>("SELECT orders.*, users.email AS customer_email FROM orders JOIN users ON orders.user_id = users.id ORDER BY orders.created_at DESC LIMIT 200");
  response.json({ orders: rows.map((row) => ({ ...orderRecord(row), customerEmail: row.customer_email })) });
});

router.get("/admin/orders/:orderId/proof", (request, response) => {
  if (!adminOnly(request, response)) return;
  const row = getRow<{ proof_data: string | null }>("SELECT proof_data FROM orders WHERE id = ?", [request.params.orderId]);
  if (!row?.proof_data) {
    response.status(404).json({ error: "Payment screenshot not found." });
    return;
  }
  const match = row.proof_data.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) {
    response.status(500).json({ error: "Payment screenshot data is invalid." });
    return;
  }
  response.setHeader("Content-Type", match[1]);
  response.setHeader("Cache-Control", "private, no-store");
  response.send(Buffer.from(match[2], "base64"));
});

router.get("/admin/orders/:orderId/artwork/:itemIndex/:side", (request, response) => {
  if (!adminOnly(request, response)) return;
  const row = getRow<{ items_json: string }>("SELECT items_json FROM orders WHERE id = ?", [request.params.orderId]);
  if (!row) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  const itemIndex = Number(request.params.itemIndex);
  const items = JSON.parse(row.items_json) as ReturnType<typeof quoteLine>[];
  const artworkKey = ({ front: "artwork", back: "backArtwork", left: "leftArtwork", right: "rightArtwork" } as const)[request.params.side as "front" | "back" | "left" | "right"];
  const side = ["front", "back", "left", "right"].includes(request.params.side) ? artworkKey : null;
  const dataUrl = side && Number.isInteger(itemIndex) && itemIndex >= 0 ? items[itemIndex]?.config[side] : null;
  const match = dataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) {
    response.status(404).json({ error: "Print artwork not found." });
    return;
  }
  response.setHeader("Content-Type", match[1]);
  response.setHeader("Cache-Control", "private, no-store");
  response.send(Buffer.from(match[2], "base64"));
});

router.post("/admin/orders/:orderId/review", (request, response) => {
  if (!adminOnly(request, response)) return;
  const decision = request.body?.decision;
  const order = getRow<{ id: string; status: string; proof_data: string | null }>("SELECT id, status, proof_data FROM orders WHERE id = ?", [request.params.orderId]);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.status !== "payment_review" || !order.proof_data || !(decision === "approve" || decision === "reject")) {
    response.status(409).json({ error: "This order is not awaiting payment review." });
    return;
  }
  const status = decision === "approve" ? "processing" : "cancelled";
  const paymentStatus = decision === "approve" ? "verified" : "rejected";
  run("UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?", [status, paymentStatus, new Date().toISOString(), order.id]);
  response.json({ ok: true, status, paymentStatus });
});

router.patch("/admin/orders/:orderId", (request, response) => {
  if (!adminOnly(request, response)) return;
  const status = request.body?.status;
  if (!(status === "shipped" || status === "delivered" || status === "cancelled")) {
    response.status(400).json({ error: "Invalid order status." });
    return;
  }
  const order = getRow<{ id: string; payment_status: string; status: string }>("SELECT id, payment_status, status FROM orders WHERE id = ?", [request.params.orderId]);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (status !== "cancelled" && order.payment_status !== "verified") {
    response.status(409).json({ error: "Verify payment before fulfilling this order." });
    return;
  }
  if (order.status === "cancelled" || order.status === "delivered") {
    response.status(409).json({ error: "This order is already closed." });
    return;
  }
  const nextStatus: Record<string, string> = { processing: "shipped", shipped: "delivered" };
  if (status !== "cancelled" && nextStatus[order.status] !== status) {
    response.status(409).json({ error: "Order status must move forward one fulfillment step at a time." });
    return;
  }
  run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [status, new Date().toISOString(), order.id]);
  response.json({ ok: true, status });
});

router.post("/bulk-requests", (request, response) => {
  const user = currentUser(request);
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const phone = typeof request.body?.phone === "string" ? request.body.phone.replace(/\D/g, "") : "";
  const details = typeof request.body?.details === "string" ? request.body.details.trim() : "";
  const quantity = Number(request.body?.quantity);
  if (name.length < 2 || name.length > 100 || !validEmail(email) || !/^[6-9]\d{9}$/.test(phone) || !Number.isInteger(quantity) || quantity < 10 || quantity > 5000 || details.length > 2000) {
    response.status(400).json({ error: "Enter a name, valid email/mobile, quantity (10–5000), and brief details." });
    return;
  }
  const id = randomUUID();
  run("INSERT INTO bulk_requests (id, user_id, name, email, phone, quantity, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)", [id, user?.id ?? null, name, email, phone, quantity, details, new Date().toISOString()]);
  response.status(201).json({ ok: true, id });
});

router.get("/admin/bulk-requests", (request, response) => {
  if (!adminOnly(request, response)) return;
  response.json({ requests: allRows("SELECT * FROM bulk_requests ORDER BY created_at DESC LIMIT 200") });
});

export default router;
