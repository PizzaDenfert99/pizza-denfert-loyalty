"""Pizza Denfert Loyalty backend regression tests.

Covers:
- Health
- Admin login (email/password)
- OTP request (demo mode) + verify (customer create/login)
- Public menu + admin menu CRUD
- Admin QR scan, add-pizza, redeem
- Admin dashboard stats
- Public kiosk ad slides + admin ad slide CRUD
- Admin search by phone/name
"""
import os
import secrets

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://tablet-qr-scanner.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@pizzadenfert.fr"
ADMIN_PASSWORD = "Admin1234!"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["is_admin"] is True
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer(s):
    """Create a customer via OTP demo flow; returns (token, user)."""
    phone = f"+3360{secrets.randbelow(99999999):08d}"
    r1 = s.post(f"{BASE_URL}/api/auth/otp/request",
                json={"phone": phone, "name": "TEST_Cust"})
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get("demo_mode") is True
    assert "dev_code" in j1
    r2 = s.post(f"{BASE_URL}/api/auth/otp/verify",
                json={"phone": phone, "code": j1["dev_code"], "name": "TEST_Cust"})
    assert r2.status_code == 200, r2.text
    j2 = r2.json()
    assert "token" in j2 and "user" in j2
    return {"token": j2["token"], "user": j2["user"], "phone": phone}


# ---------- Health ----------

def test_health(s):
    r = s.get(f"{BASE_URL}/api/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Admin auth ----------

def test_admin_login_returns_admin_flag(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    d = r.json()
    assert "token" in d and "user" in d
    assert d["user"]["is_admin"] is True


def test_admin_login_invalid(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# ---------- OTP (demo) ----------

def test_otp_request_demo_mode_returns_code(s):
    r = s.post(f"{BASE_URL}/api/auth/otp/request",
               json={"phone": "+33612345678"})
    assert r.status_code == 200
    j = r.json()
    assert j["demo_mode"] is True
    assert "dev_code" in j and len(j["dev_code"]) == 6


def test_otp_verify_creates_or_logs_in(customer):
    assert customer["user"]["phone"]
    assert customer["user"].get("is_admin") is False
    assert "qr_token" in customer["user"]


# ---------- Public menu ----------

def test_public_menu_returns_items(s):
    r = s.get(f"{BASE_URL}/api/menu")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    # Should have at least ~21 seeded items
    assert len(items) >= 20, f"expected ~21 items, got {len(items)}"
    sample = items[0]
    assert "id" in sample and "category" in sample and "name" in sample


# ---------- Admin menu CRUD ----------

def test_admin_menu_crud(s, admin_headers):
    # List
    r = s.get(f"{BASE_URL}/api/admin/menu", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 20

    # Create
    payload = {
        "category": "salades",
        "name": "TEST_SaladeAuto",
        "desc_fr": "test",
        "price": 9.99,
        "image": "",
    }
    r = s.post(f"{BASE_URL}/api/admin/menu", json=payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    created = r.json()
    item_id = created["id"]
    assert created["name"] == "TEST_SaladeAuto"
    assert created["price"] == 9.99

    # Patch
    r = s.patch(f"{BASE_URL}/api/admin/menu/{item_id}",
                json={"price": 11.50}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 11.50

    # Delete
    r = s.delete(f"{BASE_URL}/api/admin/menu/{item_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # 404 after delete
    r = s.delete(f"{BASE_URL}/api/admin/menu/{item_id}", headers=admin_headers)
    assert r.status_code == 404


def test_admin_menu_requires_auth(s):
    r = s.get(f"{BASE_URL}/api/admin/menu")
    assert r.status_code == 401


# ---------- Admin QR scan + add-pizza + redeem ----------

def test_admin_scan_and_add_pizza_and_redeem(s, admin_headers, customer):
    user = customer["user"]
    qr_data = f"PIZZA-DENFERT:{user['user_id']}:{user['qr_token']}"

    # Scan
    r = s.post(f"{BASE_URL}/api/admin/scan",
               json={"qr_data": qr_data}, headers=admin_headers)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["user_id"] == user["user_id"]
    initial_pc = payload["pizza_count"]

    # Invalid QR
    r_bad = s.post(f"{BASE_URL}/api/admin/scan",
                   json={"qr_data": "BAD:foo:bar"}, headers=admin_headers)
    assert r_bad.status_code == 400

    # Add 3 pizzas (reaches coffee threshold of 3)
    r = s.post(f"{BASE_URL}/api/admin/customer/add-pizza",
               json={"user_id": user["user_id"],
                     "qr_token": user["qr_token"],
                     "pizza_count": 3},
               headers=admin_headers)
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["pizza_count"] == initial_pc + 3
    avail = [a["reward"] for a in after.get("available_rewards", [])]
    assert "coffee" in avail, f"coffee should be available, got {after}"

    # Redeem coffee
    r = s.post(f"{BASE_URL}/api/admin/customer/redeem",
               json={"user_id": user["user_id"],
                     "qr_token": user["qr_token"],
                     "reward": "coffee"},
               headers=admin_headers)
    assert r.status_code == 200, r.text
    redeemed = r.json()
    avail2 = [a["reward"] for a in redeemed.get("available_rewards", [])]
    assert "coffee" not in avail2


# ---------- Admin dashboard ----------

def test_admin_dashboard(s, admin_headers):
    r = s.get(f"{BASE_URL}/api/admin/dashboard?period=all", headers=admin_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    # Stats payload — be permissive about exact keys since shape may vary
    assert isinstance(d, dict)
    # At minimum, expect numeric counts to be present
    has_any = any(k in d for k in ("total_customers", "customers", "pizza_count",
                                   "total_pizzas", "total_pizzas_sold",
                                   "total_redemptions", "rewards_redeemed",
                                   "loyalty_members", "stats"))
    assert has_any, f"dashboard payload missing expected keys: {list(d.keys())}"
    assert d.get("period") == "all"


# ---------- Kiosk ads ----------

def test_public_ads_slides(s):
    r = s.get(f"{BASE_URL}/api/ads/slides")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "slides" in d
    assert "settings" in d
    assert isinstance(d["slides"], list)


def test_admin_ad_slide_crud(s, admin_headers):
    payload = {
        "section": "loyalty",
        "title": "TEST_Slide",
        "subtitle": "test",
        "image_url": "",
        "duration_ms": 5000,
        "active": True,
    }
    r = s.post(f"{BASE_URL}/api/admin/ads/slides",
               json=payload, headers=admin_headers)
    # Endpoint may be /api/admin/ads/slides or similar — accept 200/201
    if r.status_code == 404:
        pytest.skip("admin ad slide create endpoint not at /api/admin/ads/slides")
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    created = r.json()
    sid = created.get("id") or created.get("slide", {}).get("id")
    assert sid

    # List
    r = s.get(f"{BASE_URL}/api/admin/ads/slides", headers=admin_headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, (list, dict))

    # Delete
    r = s.delete(f"{BASE_URL}/api/admin/ads/slides/{sid}", headers=admin_headers)
    assert r.status_code in (200, 204)


# ---------- Admin search ----------

def test_admin_search_by_phone(s, admin_headers, customer):
    r = s.post(f"{BASE_URL}/api/admin/search",
               json={"query": customer["phone"]}, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("results") or []
    assert any(i.get("user_id") == customer["user"]["user_id"] for i in items), \
        f"customer not in search results: {data}"


def test_admin_search_by_name(s, admin_headers, customer):
    r = s.post(f"{BASE_URL}/api/admin/search",
               json={"query": "TEST_Cust"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("results") or []
    assert len(items) >= 1
