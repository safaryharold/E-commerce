# Leather Artisan Pakistan — Product Requirements (PRD)

## Original Problem Statement
Build an e-commerce platform for selling real leather wallets in Pakistan with:
- Admin backend (browser-accessible)
- Product catalog, cart, checkout flow, order tracking
- Focus on major Pakistani cities (Karachi, Lahore, Islamabad, …)
- Local Pakistan payment options (JazzCash / EasyPaisa) alongside Stripe
- Quick signups
- 3D placeholder product images
- SEO-friendly smart URLs (slug-based) instead of UUIDs
- Downloadable project with admin credentials documented

## Tech Stack
- Backend: FastAPI + MongoDB (Motor) — `/app/backend/server.py`
- Frontend: React 19 + React Router v6 — `/app/frontend/src`
- Payments: Stripe (live integration via `emergentintegrations`), Mock JazzCash / EasyPaisa / COD
- Auth: JWT + bcrypt, Emergent Google OAuth helper
- Ingress: all backend routes behind `/api/*` prefix

## Admin / Test Credentials
See `/app/memory/test_credentials.md`.
- Admin: `admin@leatherwallet.pk` / `admin123`
- Mock wallet OTP: `1234`

## Implemented Features (as of Feb 23 2026)

### Products & Catalog
- Seeded 6 wallet products (Men / Women / Cardholder)
- **SEO-friendly slug URLs**: `/products/classic-brown-leather-wallet` (not UUID)
- Category path routing: `/products/category/men` (no `?category=` query string)
- Backend auto-generates slugs on product create/update
- Backfilled legacy products with slugs via one-time script

### Auth
- JWT email/password register + login
- Emergent Google OAuth session support
- Role-based admin guard

### Cart / Checkout / Orders
- Full cart CRUD (add / update qty / remove)
- Order creation from cart with Pakistani city selection (10 cities)
- Order history for customer and admin
- Admin can update order status: pending → processing → shipped → delivered

### Payments
- **Stripe** hosted checkout (real, keyed by `STRIPE_API_KEY`)
- **Mock JazzCash** wallet flow (branded gateway UI → OTP → marks order paid)
- **Mock EasyPaisa** wallet flow (same pattern)
- **Cash on Delivery** (order placed directly, payment_status=pending until delivery)
- Payment method selector radios on checkout page
- Mock gateway route: `/payment/mock?order_id=…&method=jazzcash|easypaisa`
- Backend endpoint: `POST /api/payments/mock/initiate`

### Admin Dashboard
- Products CRUD (auto-slug generation on create/update)
- Orders list with status dropdown for fulfillment

### Browser-Accessible API Docs
- Swagger UI at `/api/docs`
- OpenAPI JSON at `/api/openapi.json`
- ReDoc at `/api/redoc`
- Root JSON endpoint map at `/api/`

## Prioritized Backlog

### P1 (Next)
- Real JazzCash / EasyPaisa merchant integration (replace mock with HS256-signed payload + merchant credentials)
- Order tracking page with visual timeline (pending → processing → shipped → delivered)
- Product search bar + sort (price, newest)

### P2 (Later)
- Polish admin dashboard UI, bulk product import
- Customer reviews / ratings
- Wishlist / favorites
- Delivery fee calculation per city
- PKR currency formatting (currently USD)
- Real 3D product viewer (replace placeholder static images)
- Transactional emails (order placed / shipped)

### P3 (Nice to have)
- Discount codes / promo engine
- Inventory alerts for admin
- Analytics dashboard (revenue, top products)

## Testing Status
- Iteration 1 (2026-02-23): **PASS** — 19/19 backend + all frontend flows (see `/app/test_reports/iteration_1.json`)

## Known Limitations
- JazzCash / EasyPaisa are **MOCK** flows — no real money moves until merchant credentials are provided and `payments/mock/initiate` is swapped with a real gateway
- Stripe integration uses USD currency (needs PKR conversion for local users)
