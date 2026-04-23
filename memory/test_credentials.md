# Test Credentials

## Admin Account
- Email: `admin@leatherwallet.pk`
- Password: `admin123`
- Role: admin
- Purpose: Admin dashboard (products CRUD, orders management)

## How to seed (if DB empty)
POST to `{REACT_APP_BACKEND_URL}/api/seed` (no auth required, no-op if already seeded). This also creates the admin above.

## Mock Wallet Payment OTP
- When testing JazzCash / EasyPaisa mock flow at `/payment/mock`, use OTP `1234` to confirm payment.
- Mobile format: `03XXXXXXXXX` (11 digits). CNIC last-4: any 4 digits.
