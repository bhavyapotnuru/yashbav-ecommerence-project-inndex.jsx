# NEXORA implementation update

The project now includes a routed customer storefront, merchant workspace and administrator console built on the existing React/Vite and Express/Mongoose stack.

## Application features
- Customer catalog search, categories, sorting, pagination, product details, wishlists, cart, profile editing, order history and eligible cancellation.
- Checkout with server-validated stock and prices, `NEXORA10`, COD and simulated (non-real) payment.
- Review submission for customers with an eligible purchase.
- Approved-merchant product CRUD, image upload, merchant-scoped order visibility and per-merchant-item fulfillment updates.
- Admin overview, user role/suspension controls, merchant approvals, product/order controls, coupon management, and monthly sales reporting.
- Repeatable seed inserts any missing sample products from a 20-item catalog and secures the seeded admin using `ADMIN_SEED_PASSWORD`.

## Local configuration
- Copy `server/.env.example` to `server/.env`; the example contains placeholders only.
- Keep all actual credentials in the ignored backend `.env` file and out of Git and frontend `VITE_` variables.
- The seed command requires a unique admin password of at least 16 characters. Running it resets the seeded admin password to the configured value.

## Validation
- Run `npm run build --prefix client` for the production frontend build.
- Backend JavaScript files can be checked with `node --check`.
- Running the API and seed script requires a reachable MongoDB instance; image uploads require valid Cloudinary credentials.
