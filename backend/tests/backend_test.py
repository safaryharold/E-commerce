"""
Backend tests for Leather Wallet e-commerce platform.
Covers: Swagger/docs, products (slug), auth, cart, orders,
mock JazzCash/EasyPaisa/COD payment flow, admin product CRUD.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wallet-pk-store.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@leatherwallet.pk"
ADMIN_PASS = "admin123"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Ensure DB is seeded
    s.post(f"{API}/seed", timeout=20)
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("user", {}).get("role") == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def customer(session):
    email = f"TEST_cust_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "password123", "name": "Test Customer"
    }, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "token": data["token"], "id": data["user"]["id"]}


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Docs / root ----------

class TestDocs:
    def test_swagger_ui(self, session):
        r = session.get(f"{API}/docs", timeout=15)
        assert r.status_code == 200
        assert "swagger" in r.text.lower() or "openapi" in r.text.lower()

    def test_openapi_json(self, session):
        r = session.get(f"{API}/openapi.json", timeout=15)
        assert r.status_code == 200
        assert r.json().get("openapi")

    def test_root_api(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)


# ---------- Products ----------

class TestProducts:
    def test_list_products_have_slug(self, session):
        r = session.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p.get("slug"), f"Product missing slug: {p}"
            assert p.get("id")
            assert p.get("category")

    def test_category_filter_men(self, session):
        r = session.get(f"{API}/products/category/men", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(p["category"] == "men" for p in items)

    def test_get_by_slug(self, session):
        r = session.get(f"{API}/products/classic-brown-leather-wallet", timeout=15)
        assert r.status_code == 200
        p = r.json()
        assert p["slug"] == "classic-brown-leather-wallet"
        assert p["name"]


# ---------- Auth ----------

class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_register_customer(self, customer):
        assert customer["token"]
        assert customer["id"]

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"}, timeout=15)
        assert r.status_code in (400, 401)


# ---------- Cart ----------

class TestCart:
    def test_cart_flow(self, session, customer):
        token = customer["token"]
        # Get product
        prods = session.get(f"{API}/products", timeout=15).json()
        pid = prods[0]["id"]

        # Add
        r = session.post(f"{API}/cart", json={"product_id": pid, "quantity": 2}, headers=hdr(token), timeout=15)
        assert r.status_code == 200, r.text

        # Get
        r = session.get(f"{API}/cart", headers=hdr(token), timeout=15)
        assert r.status_code == 200
        cart = r.json()
        items = cart.get("items", [])
        assert any(i["product_id"] == pid and i["quantity"] == 2 for i in items)

        # Update qty
        r = session.put(f"{API}/cart/{pid}?quantity=3", headers=hdr(token), timeout=15)
        assert r.status_code == 200, r.text

        r = session.get(f"{API}/cart", headers=hdr(token), timeout=15)
        items = r.json()["items"]
        assert any(i["product_id"] == pid and i["quantity"] == 3 for i in items)

        # Remove
        r = session.delete(f"{API}/cart/{pid}", headers=hdr(token), timeout=15)
        assert r.status_code == 200

        r = session.get(f"{API}/cart", headers=hdr(token), timeout=15)
        items = r.json()["items"]
        assert not any(i["product_id"] == pid for i in items)


# ---------- Orders + Mock Payments ----------

def _create_order(session, customer, payment_method="jazzcash"):
    prods = session.get(f"{API}/products", timeout=15).json()
    p = prods[0]
    # Add to cart first (order creation reads cart)
    session.post(f"{API}/cart", json={"product_id": p["id"], "quantity": 1},
                 headers=hdr(customer["token"]), timeout=15)
    payload = {
        "delivery_city": "Karachi",
        "delivery_address": "123 Main Street",
        "delivery_phone": "03001234567",
        "payment_method": payment_method,
    }
    r = session.post(f"{API}/orders", json=payload, headers=hdr(customer["token"]), timeout=20)
    assert r.status_code == 200, f"order create failed {r.status_code} {r.text}"
    data = r.json()
    return {"id": data.get("order_id") or data.get("id"), "total_amount": data.get("total_amount"),
            "payment_method": payment_method}


class TestOrdersPayments:
    def test_create_order_jazzcash(self, session, customer):
        order = _create_order(session, customer, "jazzcash")
        assert order.get("id")
        assert order.get("payment_method") == "jazzcash"

    def test_mock_jazzcash_paid(self, session, customer):
        order = _create_order(session, customer, "jazzcash")
        r = session.post(f"{API}/payments/mock/initiate", json={
            "order_id": order["id"],
            "method": "jazzcash",
            "mobile_number": "03001234567",
            "cnic_last4": "1234",
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"].startswith("MOCK-JAZZCASH-")
        assert data["payment_status"] == "paid"

        # Verify order updated
        r = session.get(f"{API}/orders/{order['id']}", headers=hdr(customer["token"]), timeout=15)
        o = r.json()
        assert o["payment_status"] == "paid"
        assert o["status"] == "processing"

    def test_mock_easypaisa_paid(self, session, customer):
        order = _create_order(session, customer, "easypaisa")
        r = session.post(f"{API}/payments/mock/initiate", json={
            "order_id": order["id"],
            "method": "easypaisa",
            "mobile_number": "03009999999",
            "cnic_last4": "5678",
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "EASYPAISA" in data["session_id"]
        assert data["payment_status"] == "paid"

    def test_mock_cod_pending(self, session, customer):
        order = _create_order(session, customer, "cod")
        r = session.post(f"{API}/payments/mock/initiate", json={
            "order_id": order["id"],
            "method": "cod",
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["payment_status"] == "pending"
        r = session.get(f"{API}/orders/{order['id']}", headers=hdr(customer["token"]), timeout=15)
        o = r.json()
        assert o["status"] == "processing"
        assert o["payment_status"] == "pending"

    def test_mock_rejects_invalid_method(self, session, customer):
        order = _create_order(session, customer, "jazzcash")
        r = session.post(f"{API}/payments/mock/initiate", json={
            "order_id": order["id"],
            "method": "bitcoin",
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code == 400

    def test_mock_rejects_missing_mobile(self, session, customer):
        order = _create_order(session, customer, "jazzcash")
        r = session.post(f"{API}/payments/mock/initiate", json={
            "order_id": order["id"],
            "method": "jazzcash",
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code == 400

    def test_admin_update_order_status(self, session, customer, admin_token):
        order = _create_order(session, customer, "cod")
        r = session.put(f"{API}/orders/{order['id']}/status?status=shipped",
                        headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        r = session.get(f"{API}/orders/{order['id']}", headers=hdr(customer["token"]), timeout=15)
        assert r.json()["status"] == "shipped"


# ---------- Admin Product CRUD ----------

class TestAdminProducts:
    def test_admin_create_with_auto_slug(self, session, admin_token):
        name = f"TEST Wallet {uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/products", json={
            "name": name,
            "description": "Test desc",
            "category": "men",
            "price": 99.0,
            "image_url": "https://example.com/x.jpg",
            "stock": 10,
        }, headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["slug"]
        assert p["slug"].startswith("test-wallet")
        pid = p["id"]

        # Update
        r = session.put(f"{API}/products/{pid}", json={
            "name": name + " Updated",
            "description": "updated",
            "category": "men",
            "price": 120.0,
            "image_url": "https://example.com/x.jpg",
            "stock": 5,
        }, headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

        # Delete
        r = session.delete(f"{API}/products/{pid}", headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200

    def test_non_admin_cannot_create(self, session, customer):
        r = session.post(f"{API}/products", json={
            "name": "blocked", "description": "x", "category": "men",
            "price": 1.0, "image_url": "https://x.com/a.jpg", "stock": 1
        }, headers=hdr(customer["token"]), timeout=15)
        assert r.status_code in (401, 403)
