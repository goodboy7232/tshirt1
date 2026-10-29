# Backbenchers T-Shirt Studio

Backbenchers custom t-shirt storefront with a brand-led homepage, catalog, separate editor, ready-made design collections, account gate, and super-admin preview.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tshirt-studio/src/App.tsx` — storefront routes, editor, account gate, and admin preview
- `artifacts/tshirt-studio/src/data.ts` — seeded catalog items, garment fits/necks, local product-photo paths, ready-made categories, and testimonials
- `artifacts/tshirt-studio/public/product-images/` — bundled 2D garment reference photography used by the storefront
- `artifacts/tshirt-studio/src/index.css` — Backbenchers visual system and responsive layout
- `artifacts/api-server/` — shared API server scaffold for future OTP, orders, and persistence
- `attached_assets/` — user-provided login-flow notes and future design assets

## Architecture decisions

- Homepage and editor are separate routes; homepage never exposes the live customer price.
- Guests can browse and design, while phone OTP is requested for account creation, design uploads, save, bag, and checkout actions.
- The first storefront build keeps catalog, auth, uploads, and admin changes local so the UX is usable before persistence is connected.
- The t-shirt preview is CSS-rendered so real product images/3D assets can replace the seeded visuals later.

## Product

- Backbenchers lets shoppers browse round-neck and polo blanks, inspect front/back/side views in the editor, add placement/text/artwork, and reveal a transparent estimate on demand.
- Current studio supports the supplied pricing rules: ₹220 base round-neck, print placement pricing, ELOW pricing, and ₹50 per text side.
- Homepage includes ready-made categories, upload-your-design, squad ordering, bulk business sections, testimonials, and WhatsApp contact.
- Protected actions open a demo Indian phone OTP flow and are ready to be wired to a real SMS/WhatsApp provider.

## User preferences

- Modern, simple, easy-to-use website.
- Brand name and uploaded logo: Backbenchers.
- Product catalog uses 2D garment photos for regular fit, oversized, round neck, V-neck, and polo collar variants instead of 3D/CSS shirt models.
- User will provide the real 2D product pictures and OTP API later.

## Gotchas

- Remove-background is intentionally marked as a future integration until an image-processing provider is chosen.
- The current OTP screen accepts any 4-digit code as a demo; connect a real provider before production use.
- Admin/catalog/upload/order data is preview-only until API/database persistence and role enforcement are added.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
