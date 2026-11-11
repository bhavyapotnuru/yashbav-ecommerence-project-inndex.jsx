# NEXORA — MERN E-Commerce Platform

A responsive multi-role marketplace with a React/Vite storefront, Express API, MongoDB Atlas, JWT authentication, Cloudinary product media, customer shopping, merchant workspace, administrator controls, COD and simulated online payment.

## Requirements
- Node.js 22 LTS recommended (Node 20+ supported)
- MongoDB Atlas cluster
- Cloudinary account (image uploads are disabled until configured)

## Local setup (Windows PowerShell)

### Prepare a ZIP to move to another computer

Create a ZIP of the project source, but do **not** include:
- `server/.env` or any other `.env` file (they contain private credentials).
- Any `node_modules` or `dist` folders; these are recreated on the destination computer.
- `.git` (optional; include it only if you specifically need the Git history).

Keep the safe `server/.env.example` and `client/.env.example` files in the ZIP. Transfer `server/.env` separately through a secure method if you need to preserve its settings, or create a fresh one from the example below. Do not send secrets in chat or publish them with the ZIP.

### Set up and run after extracting

1. Install Node.js 22 LTS (Node 20+ is supported) on the destination computer. MongoDB Compass/VS Code extensions are optional; this project connects to MongoDB Atlas using the URI in `server/.env`.
2. Open a PowerShell terminal in the extracted project root (the folder containing the root `package.json`) and install dependencies:

```powershell
npm run install:all
```

3. Create the backend environment file from the safe template:

```powershell
Copy-Item server\.env.example server\.env
```

4. Edit `server/.env` and set:
   - `MONGO_URI`: Atlas connection string with database name `nexora`.
   - `JWT_SECRET`: generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
   - Cloudinary cloud name, API key and API secret (keep secret private).
   - `ADMIN_SEED_PASSWORD`: choose a unique password of at least 16 characters for `ADMIN_EMAIL`.

   URL-encode special characters in the MongoDB database password. Do not commit `.env`; `.env.example` contains placeholders only. Running the seed command sets or resets the seeded administrator password to this value.

   For a different computer, use the exact Atlas Drivers URI, ensure its public IP is allowed in Atlas Network Access, and use the Atlas Database Access user. Cloudinary fields can stay blank if image upload is not needed locally.

5. Seed the administrator and sample catalog:

```powershell
npm run seed --prefix server
```

The seed script creates or secures `nexoraecommerce1111@gmail.com` as admin only when `ADMIN_SEED_PASSWORD` is set. It adds any missing demo catalog entries (20 sample products across the four categories) without replacing existing products.

6. Start both frontend and backend:

```powershell
npm run dev
```

Open http://localhost:5173. API health: http://localhost:5000/api/health.
Keep this terminal open while using the app. Press `Ctrl+C` to stop both servers. On subsequent runs, skip dependency installation and database seeding; run `npm run dev` from the project root.

## Roles and storefront
- Customer: self-registration, searchable/filterable catalog, product details and verified-purchase reviews, persistent wishlist/cart, checkout, profile editing, order history and eligible order cancellation.
- Merchant: self-registration; must be approved by an admin before product and order operations are enabled. Approved merchants can manage their catalog, upload product images and update fulfillment for their own order items.
- Admin: created by the seed script using `ADMIN_EMAIL` and `ADMIN_SEED_PASSWORD`; never selectable through public registration. Admin workspace includes overview, user suspension/role controls, merchant approvals, product/order management, coupon management and monthly sales reports.

## API overview
- `/api/auth`: register, login, current user, profile
- `/api/products`: catalog, product CRUD, reviews, merchant's own products
- `/api/orders`: checkout, customer orders, merchant orders, admin order list, status and cancellation
- `/api/merchant`: merchant overview and fulfillment orders
- `/api/admin`: platform overview, users, merchant approval, product list and reports
- `/api/coupons`: public coupon validation and administrator coupon management
- `/api/uploads`: authenticated Cloudinary image upload/delete
- `/api/health`: service/database status

Checkout uses server-calculated prices, 5% demo tax, ₹99 delivery below ₹4,999 and free delivery at/above ₹4,999. The seed creates `NEXORA10` (10%, capped at ₹500); administrators can add, configure and deactivate coupons. Payment methods are COD and simulated online payment; simulated payment is not a real payment processor. Inventory is checked and reserved by the API at checkout.

## Deployment
- Backend: deploy `server` to Render. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your Vercel URL), and Cloudinary variables in Render environment settings. Render's `render.yaml` is a starting blueprint.
- Frontend: deploy `client` to Vercel. Set `VITE_API_URL` to `https://YOUR-RENDER-SERVICE.onrender.com/api`. Build command `npm run build`, output directory `dist`.
- Add your Vercel domain to `CLIENT_ORIGIN` on Render.

## Security notes
- Keep server `.env` out of Git. Never put Cloudinary API secret, MongoDB password or JWT secret in `client/.env` or any `VITE_` variable.
- Admin role is never assignable through public registration.
- Merchant API access is blocked until approval.
- This is a hackathon/academic implementation. Before real production use, add automated integration tests, a dedicated payment gateway, email verification/password reset, database transactions for inventory and order changes, audit logs, and operational monitoring.
