# T-shirt studio commerce setup

## Payment QR configuration

The checkout builds a UPI QR locally in the browser. No real payment provider or bank confirmation is connected; customers submit a screenshot and an administrator verifies the transaction manually.

1. Copy `artifacts/tshirt-studio/.env.example` to `artifacts/tshirt-studio/.env.local`.
2. Replace `VITE_UPI_ID` with the business's verified UPI ID and set the payee name. Do not use a personal/demo UPI ID for production.
3. Restart the Vite dev server after changing the file. Full payment QR encodes the order total; the booking option encodes ₹100 and the order number.
4. Test with a small payment and confirm the receiving bank account, amount, and order note before sharing the site with customers.

The app does not receive a verified payment callback. A screenshot is only a claim, not proof of settlement: open the merchant's UPI/bank app and verify the transaction ID, amount, date, and recipient before clicking **Verify payment & approve**. Reject mismatches; rejection cancels the order. Production/shipping actions are blocked until payment has been approved.

## Locked admin route and first administrator credentials

Admin panel URL: `http://localhost:5000/atelier-console` locally, or `https://YOUR-DOMAIN/atelier-console` after deployment. All admin APIs check the signed-in user's server-side role; knowing this URL does not grant access. Customer signup can never assign an admin role.

1. Choose the real administrator's own email address. There is no shared/default admin username or password in the app.
2. Before starting the API, set a private random `ADMIN_BOOTSTRAP_TOKEN` of at least 32 characters. In production, also set `ADMIN_BOOTSTRAP_ENABLED=true` only for this one-time setup. Never put these values in `VITE_*`, frontend code, or a checked-in file.
3. Create that admin account once by sending `POST /api/admin/bootstrap` with header `x-admin-bootstrap-token: <your private token>` and JSON body `{ "email": "YOUR-ADMIN-EMAIL", "password": "YOUR-UNIQUE-16+-CHARACTER-PASSWORD" }`. Example locally, when API is on port 3001: `http://localhost:3001/api/admin/bootstrap`.
4. Sign in from the site's **Login** button with the email/password you just chose, then open `/atelier-console`.
5. After setup, remove `ADMIN_BOOTSTRAP_TOKEN` and turn off/unset `ADMIN_BOOTSTRAP_ENABLED`, then restart the API. The bootstrap endpoint refuses any further administrator creation once an admin exists.

Those credentials are intentionally not hard-coded or shared in this repository. Store them in the operator's password manager. Give each administrator their own account; never share one login between staff. The normal user login page is the same `/account` flow used by customers; role authorization is decided on the server.

Keep the bootstrap token and admin password private. Use HTTPS in deployment. Do not commit `.env.local` or production credentials.

The admin panel's **Catalog management** tab shows the current catalog and lets an administrator update names, tags, descriptions, prices, colors, garment details, and images. Images can be uploaded as PNG/JPG/WebP files up to 4 MB or entered as an HTTPS/local asset URL. Administrators can also add or remove products. Changes are stored in the API database, apply to future server-side quotes, and are loaded by the storefront from `GET /api/catalog`.

The **Ready-made designs** admin tab manages ready-made categories and designs. Administrators can add categories, edit names/slugs/icons/colors, add designs, assign designs to categories, and edit design names, tags, descriptions, colors, accents, and image URLs. These settings are stored server-side and are loaded by the storefront from `GET /api/ready-made`.

## Local database and files

Accounts, sessions, carts, saved designs, orders, uploaded design images, and payment screenshots are stored in the API's SQLite file under `artifacts/api-server/data/accounts.sqlite` by default. Set `AUTH_DATA_DIR` to a persistent, backed-up location before deployment. The local SQLite setup is intended for a single API instance; move to managed PostgreSQL/object storage before running multiple API instances or expecting production-grade backups.

Orders calculate product/print/text totals on the server. Delivery is free above ₹500 and otherwise ₹60. Customers can choose full payment or a ₹100 booking payment; cash on delivery is currently disabled. Each editor side is flattened into a high-resolution PNG so the admin order desk can inspect the complete text, image, and drawing composition. Prices in this prototype are estimates and tax treatment is not configured; verify product pricing, GST invoicing, shipping policy, refund policy, and privacy terms before real sales.

## Run locally on Windows

Run the Vite storefront and API in separate terminals from the workspace root:

- `pnpm --filter @workspace/api-server dev`
- `pnpm --filter @workspace/tshirt-studio dev`

The API listens on port 3001; Vite listens on 5000 and proxies `/api` requests to it.
