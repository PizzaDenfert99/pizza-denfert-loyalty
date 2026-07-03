#!/usr/bin/env python3
"""
Comprehensive backend test suite for Pizza Denfert Loyalty API
Tests all endpoints as specified in the review request
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

# Base URL from frontend/.env
BASE_URL = "https://e5a73cdc-c766-4d36-8ed1-8ed2a54a2645.preview.emergentagent.com/api"

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "admin@pizzadenfert.fr"
ADMIN_PASSWORD = "Admin1234!"

# Test data
TEST_CUSTOMER_PHONE = "+33612345678"
TEST_CUSTOMER_NAME = "Jean Dupont"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def log_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.END}")

def log_fail(msg: str, details: str = ""):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.END}")
    if details:
        print(f"{Colors.RED}  Details: {details}{Colors.END}")

def log_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.END}")

class TestState:
    """Store test state across tests"""
    admin_token: Optional[str] = None
    admin_user: Optional[Dict] = None
    customer_token: Optional[str] = None
    customer_user: Optional[Dict] = None
    customer_qr_data: Optional[str] = None
    test_menu_item_id: Optional[str] = None
    test_reservation_id: Optional[str] = None
    test_staff_user_id: Optional[str] = None
    test_slide_id: Optional[str] = None

state = TestState()

def test_1_admin_login():
    """Test 1: Admin login with email+password"""
    log_test("1. Admin Login (email+password)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code != 200:
            log_fail(f"Admin login failed with status {response.status_code}", response.text)
            return False
        
        data = response.json()
        
        if "token" not in data:
            log_fail("No token in response", json.dumps(data, indent=2))
            return False
        
        if "user" not in data:
            log_fail("No user in response", json.dumps(data, indent=2))
            return False
        
        user = data["user"]
        if not user.get("is_admin"):
            log_fail("User is_admin is not True", json.dumps(user, indent=2))
            return False
        
        state.admin_token = data["token"]
        state.admin_user = user
        
        log_pass(f"Admin login successful. Token: {state.admin_token[:20]}...")
        log_pass(f"Admin user: {user.get('name')} ({user.get('email')}), is_admin={user.get('is_admin')}")
        
        # Test GET /api/auth/me with admin token
        me_response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if me_response.status_code != 200:
            log_fail(f"GET /auth/me failed with status {me_response.status_code}", me_response.text)
            return False
        
        me_data = me_response.json()
        if me_data.get("user_id") != user.get("user_id"):
            log_fail("GET /auth/me returned different user", json.dumps(me_data, indent=2))
            return False
        
        log_pass("GET /auth/me verified successfully")
        return True
        
    except Exception as e:
        log_fail(f"Exception during admin login: {str(e)}")
        return False

def test_2_customer_otp_auth():
    """Test 2: Customer OTP authentication (demo mode)"""
    log_test("2. Customer OTP Auth (demo mode)")
    
    try:
        # Step 1: Request OTP
        log_info(f"Requesting OTP for {TEST_CUSTOMER_PHONE}")
        request_response = requests.post(
            f"{BASE_URL}/auth/otp/request",
            json={"phone": TEST_CUSTOMER_PHONE, "name": TEST_CUSTOMER_NAME},
            timeout=10
        )
        
        if request_response.status_code != 200:
            log_fail(f"OTP request failed with status {request_response.status_code}", request_response.text)
            return False
        
        request_data = request_response.json()
        
        if not request_data.get("ok"):
            log_fail("OTP request returned ok=false", json.dumps(request_data, indent=2))
            return False
        
        if "dev_code" not in request_data:
            log_fail("No dev_code in OTP request response (demo mode should return dev_code)", json.dumps(request_data, indent=2))
            return False
        
        dev_code = request_data["dev_code"]
        log_pass(f"OTP request successful. Dev code: {dev_code}")
        
        # Step 2: Verify OTP
        log_info(f"Verifying OTP with code {dev_code}")
        verify_response = requests.post(
            f"{BASE_URL}/auth/otp/verify",
            json={"phone": TEST_CUSTOMER_PHONE, "code": dev_code, "name": TEST_CUSTOMER_NAME},
            timeout=10
        )
        
        if verify_response.status_code != 200:
            log_fail(f"OTP verify failed with status {verify_response.status_code}", verify_response.text)
            return False
        
        verify_data = verify_response.json()
        
        if "token" not in verify_data:
            log_fail("No token in verify response", json.dumps(verify_data, indent=2))
            return False
        
        if "user" not in verify_data:
            log_fail("No user in verify response", json.dumps(verify_data, indent=2))
            return False
        
        user = verify_data["user"]
        if user.get("is_admin"):
            log_fail("Customer user has is_admin=True (should be False)", json.dumps(user, indent=2))
            return False
        
        state.customer_token = verify_data["token"]
        state.customer_user = user
        
        log_pass(f"OTP verify successful. Customer token: {state.customer_token[:20]}...")
        log_pass(f"Customer user: {user.get('name')} ({user.get('phone')}), user_id={user.get('user_id')}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during OTP auth: {str(e)}")
        return False

def test_3_loyalty_card():
    """Test 3: Loyalty card - GET /api/loyalty/me"""
    log_test("3. Loyalty Card (GET /api/loyalty/me)")
    
    if not state.customer_token:
        log_fail("No customer token available. Skipping test.")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/loyalty/me",
            headers={"Authorization": f"Bearer {state.customer_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            log_fail(f"GET /loyalty/me failed with status {response.status_code}", response.text)
            return False
        
        data = response.json()
        
        required_fields = ["pizza_count", "qr_token", "qr_data", "thresholds", "available_rewards"]
        for field in required_fields:
            if field not in data:
                log_fail(f"Missing field '{field}' in loyalty response", json.dumps(data, indent=2))
                return False
        
        # Verify QR data format: PIZZA-DENFERT:{user_id}:{qr_token}
        qr_data = data["qr_data"]
        if not qr_data.startswith("PIZZA-DENFERT:"):
            log_fail(f"Invalid QR data format: {qr_data}")
            return False
        
        parts = qr_data.split(":")
        if len(parts) != 3:
            log_fail(f"Invalid QR data format (expected 3 parts): {qr_data}")
            return False
        
        state.customer_qr_data = qr_data
        
        # Verify thresholds
        thresholds = data["thresholds"]
        expected_thresholds = {"coffee": 3, "dessert": 5, "margherita": 10}
        if thresholds != expected_thresholds:
            log_fail(f"Thresholds mismatch. Expected {expected_thresholds}, got {thresholds}")
            return False
        
        log_pass(f"Loyalty card retrieved successfully")
        log_pass(f"Pizza count: {data['pizza_count']}, QR data: {qr_data}")
        log_pass(f"Thresholds: coffee={thresholds['coffee']}, dessert={thresholds['dessert']}, margherita={thresholds['margherita']}")
        log_pass(f"Available rewards: {data['available_rewards']}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during loyalty card test: {str(e)}")
        return False

def test_4_qr_code_scanning():
    """Test 4: QR code scanning - POST /api/admin/scan"""
    log_test("4. QR Code Scanning (POST /api/admin/scan)")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    if not state.customer_qr_data:
        log_fail("No customer QR data available. Skipping test.")
        return False
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/scan",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"qr_data": state.customer_qr_data},
            timeout=10
        )
        
        if response.status_code != 200:
            log_fail(f"POST /admin/scan failed with status {response.status_code}", response.text)
            return False
        
        data = response.json()
        
        required_fields = ["user_id", "qr_token", "pizza_count", "available_rewards", "thresholds"]
        for field in required_fields:
            if field not in data:
                log_fail(f"Missing field '{field}' in scan response", json.dumps(data, indent=2))
                return False
        
        if data["user_id"] != state.customer_user.get("user_id"):
            log_fail(f"User ID mismatch. Expected {state.customer_user.get('user_id')}, got {data['user_id']}")
            return False
        
        log_pass(f"QR code scan successful")
        log_pass(f"Customer: {data.get('name')} (user_id={data['user_id']})")
        log_pass(f"Pizza count: {data['pizza_count']}, Available rewards: {data['available_rewards']}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during QR scan test: {str(e)}")
        return False

def test_5_loyalty_points_add_remove():
    """Test 5: Loyalty points add/remove - POST /api/admin/customer/add-pizza"""
    log_test("5. Loyalty Points Add/Remove (POST /api/admin/customer/add-pizza)")
    
    if not state.admin_token or not state.customer_user:
        log_fail("Missing admin token or customer user. Skipping test.")
        return False
    
    try:
        user_id = state.customer_user["user_id"]
        qr_token = state.customer_user["qr_token"]
        
        # Test 1: Add 10 pizzas
        log_info("Adding 10 pizzas")
        add_response = requests.post(
            f"{BASE_URL}/admin/customer/add-pizza",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"user_id": user_id, "qr_token": qr_token, "pizza_count": 10},
            timeout=10
        )
        
        if add_response.status_code != 200:
            log_fail(f"Add pizza failed with status {add_response.status_code}", add_response.text)
            return False
        
        add_data = add_response.json()
        
        if add_data["pizza_count"] != 10:
            log_fail(f"Pizza count after add should be 10, got {add_data['pizza_count']}")
            return False
        
        log_pass(f"Added 10 pizzas successfully. New count: {add_data['pizza_count']}")
        
        # Verify available rewards (10 pizzas = coffee + dessert + margherita)
        available = add_data.get("available_rewards", [])
        reward_names = [r["reward"] for r in available]
        
        if "coffee" not in reward_names:
            log_fail(f"Coffee reward should be available at 10 pizzas. Available: {reward_names}")
            return False
        if "dessert" not in reward_names:
            log_fail(f"Dessert reward should be available at 10 pizzas. Available: {reward_names}")
            return False
        if "margherita" not in reward_names:
            log_fail(f"Margherita reward should be available at 10 pizzas. Available: {reward_names}")
            return False
        
        log_pass(f"Available rewards verified: {reward_names}")
        
        # Test 2: Remove 3 pizzas
        log_info("Removing 3 pizzas")
        remove_response = requests.post(
            f"{BASE_URL}/admin/customer/add-pizza",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"user_id": user_id, "qr_token": qr_token, "pizza_count": -3},
            timeout=10
        )
        
        if remove_response.status_code != 200:
            log_fail(f"Remove pizza failed with status {remove_response.status_code}", remove_response.text)
            return False
        
        remove_data = remove_response.json()
        
        if remove_data["pizza_count"] != 7:
            log_fail(f"Pizza count after remove should be 7, got {remove_data['pizza_count']}")
            return False
        
        log_pass(f"Removed 3 pizzas successfully. New count: {remove_data['pizza_count']}")
        
        # Test 3: Try to remove more than owned (should clamp at 0)
        log_info("Trying to remove 20 pizzas (should clamp at 0)")
        clamp_response = requests.post(
            f"{BASE_URL}/admin/customer/add-pizza",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"user_id": user_id, "qr_token": qr_token, "pizza_count": -20},
            timeout=10
        )
        
        if clamp_response.status_code != 200:
            log_fail(f"Clamp test failed with status {clamp_response.status_code}", clamp_response.text)
            return False
        
        clamp_data = clamp_response.json()
        
        if clamp_data["pizza_count"] != 0:
            log_fail(f"Pizza count should be clamped at 0, got {clamp_data['pizza_count']}")
            return False
        
        log_pass(f"Clamp test successful. Count clamped at 0")
        
        # Restore to 10 for next tests
        log_info("Restoring to 10 pizzas for subsequent tests")
        restore_response = requests.post(
            f"{BASE_URL}/admin/customer/add-pizza",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"user_id": user_id, "qr_token": qr_token, "pizza_count": 10},
            timeout=10
        )
        
        if restore_response.status_code == 200:
            log_pass("Restored to 10 pizzas")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during loyalty points test: {str(e)}")
        return False

def test_6_rewards_redemption():
    """Test 6: Rewards redemption - POST /api/admin/customer/redeem"""
    log_test("6. Rewards Redemption (POST /api/admin/customer/redeem)")
    
    if not state.admin_token or not state.customer_user:
        log_fail("Missing admin token or customer user. Skipping test.")
        return False
    
    try:
        user_id = state.customer_user["user_id"]
        qr_token = state.customer_user["qr_token"]
        
        # Redeem coffee reward
        log_info("Redeeming coffee reward")
        redeem_response = requests.post(
            f"{BASE_URL}/admin/customer/redeem",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"user_id": user_id, "qr_token": qr_token, "reward": "coffee"},
            timeout=10
        )
        
        if redeem_response.status_code != 200:
            log_fail(f"Redeem failed with status {redeem_response.status_code}", redeem_response.text)
            return False
        
        redeem_data = redeem_response.json()
        
        # Verify rewards_redeemed and rewards_history updated
        if "available_rewards" not in redeem_data:
            log_fail("No available_rewards in redeem response", json.dumps(redeem_data, indent=2))
            return False
        
        if "history" not in redeem_data:
            log_fail("No history in redeem response", json.dumps(redeem_data, indent=2))
            return False
        
        history = redeem_data["history"]
        if len(history) == 0:
            log_fail("Rewards history is empty after redemption")
            return False
        
        last_redemption = history[-1]
        if last_redemption.get("reward") != "coffee":
            log_fail(f"Last redemption should be coffee, got {last_redemption.get('reward')}")
            return False
        
        log_pass(f"Coffee reward redeemed successfully")
        log_pass(f"Rewards history: {len(history)} redemptions")
        log_pass(f"Available rewards after redemption: {redeem_data['available_rewards']}")
        
        # Test customer self-redeem endpoint
        log_info("Testing customer self-redeem endpoint")
        self_redeem_response = requests.post(
            f"{BASE_URL}/loyalty/redeem",
            headers={"Authorization": f"Bearer {state.customer_token}"},
            json={"reward": "dessert"},
            timeout=10
        )
        
        if self_redeem_response.status_code != 200:
            log_fail(f"Customer self-redeem failed with status {self_redeem_response.status_code}", self_redeem_response.text)
            return False
        
        self_redeem_data = self_redeem_response.json()
        if not self_redeem_data.get("ok"):
            log_fail("Customer self-redeem returned ok=false", json.dumps(self_redeem_data, indent=2))
            return False
        
        log_pass(f"Customer self-redeem successful: {self_redeem_data.get('redeemed')}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during rewards redemption test: {str(e)}")
        return False

def test_7_customer_search():
    """Test 7: Customer accounts search - POST /api/admin/search"""
    log_test("7. Customer Accounts Search (POST /api/admin/search)")
    
    if not state.admin_token or not state.customer_user:
        log_fail("Missing admin token or customer user. Skipping test.")
        return False
    
    try:
        # Search by phone
        log_info(f"Searching by phone: {TEST_CUSTOMER_PHONE}")
        phone_response = requests.post(
            f"{BASE_URL}/admin/search",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"query": TEST_CUSTOMER_PHONE},
            timeout=10
        )
        
        if phone_response.status_code != 200:
            log_fail(f"Search by phone failed with status {phone_response.status_code}", phone_response.text)
            return False
        
        phone_results = phone_response.json()
        
        if not isinstance(phone_results, list):
            log_fail(f"Search results should be a list, got {type(phone_results)}")
            return False
        
        if len(phone_results) == 0:
            log_fail("Search by phone returned no results")
            return False
        
        found = False
        for result in phone_results:
            if result.get("user_id") == state.customer_user["user_id"]:
                found = True
                break
        
        if not found:
            log_fail(f"Customer not found in phone search results")
            return False
        
        log_pass(f"Search by phone successful. Found {len(phone_results)} result(s)")
        
        # Search by name
        log_info(f"Searching by name: {TEST_CUSTOMER_NAME}")
        name_response = requests.post(
            f"{BASE_URL}/admin/search",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"query": TEST_CUSTOMER_NAME},
            timeout=10
        )
        
        if name_response.status_code != 200:
            log_fail(f"Search by name failed with status {name_response.status_code}", name_response.text)
            return False
        
        name_results = name_response.json()
        
        if len(name_results) == 0:
            log_fail("Search by name returned no results")
            return False
        
        log_pass(f"Search by name successful. Found {len(name_results)} result(s)")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during customer search test: {str(e)}")
        return False

def test_8_reservations():
    """Test 8: Reservations - availability, create, list, day view, update"""
    log_test("8. Reservations (availability, create, list, day, update)")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    try:
        # Get a future date
        future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        test_time = "20:00"
        
        # Test 1: Check availability
        log_info(f"Checking availability for {future_date} at {test_time}")
        avail_response = requests.get(
            f"{BASE_URL}/reservations/availability",
            params={"date": future_date, "time": test_time},
            timeout=10
        )
        
        if avail_response.status_code != 200:
            log_fail(f"Availability check failed with status {avail_response.status_code}", avail_response.text)
            return False
        
        avail_data = avail_response.json()
        
        if "zones" not in avail_data:
            log_fail("No zones in availability response", json.dumps(avail_data, indent=2))
            return False
        
        zones = avail_data["zones"]
        if "indoor" not in zones or "terrace" not in zones:
            log_fail("Missing indoor or terrace zone in availability", json.dumps(zones, indent=2))
            return False
        
        log_pass(f"Availability check successful")
        log_pass(f"Indoor: {zones['indoor']['available']}/{zones['indoor']['capacity']} available")
        log_pass(f"Terrace: {zones['terrace']['available']}/{zones['terrace']['capacity']} available")
        
        # Test 2: Create reservation
        log_info(f"Creating reservation for {future_date} at {test_time}")
        create_response = requests.post(
            f"{BASE_URL}/admin/reservations",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={
                "date": future_date,
                "time": test_time,
                "guests": 4,
                "name": "Test Reservation",
                "phone": "+33698765432",
                "zone": "indoor",
                "notes": "Test reservation from automated tests"
            },
            timeout=10
        )
        
        if create_response.status_code not in [200, 201]:
            log_fail(f"Create reservation failed with status {create_response.status_code}", create_response.text)
            return False
        
        create_data = create_response.json()
        
        if "id" not in create_data:
            log_fail("No id in create reservation response", json.dumps(create_data, indent=2))
            return False
        
        state.test_reservation_id = create_data["id"]
        
        log_pass(f"Reservation created successfully. ID: {state.test_reservation_id}")
        log_pass(f"Status: {create_data.get('status')}, Table: {create_data.get('table_no')}")
        
        # Test 3: List reservations (upcoming)
        log_info("Listing upcoming reservations")
        list_response = requests.get(
            f"{BASE_URL}/admin/reservations",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            params={"period": "upcoming"},
            timeout=10
        )
        
        if list_response.status_code != 200:
            log_fail(f"List reservations failed with status {list_response.status_code}", list_response.text)
            return False
        
        list_data = list_response.json()
        
        if "items" not in list_data:
            log_fail("No items in list response", json.dumps(list_data, indent=2))
            return False
        
        log_pass(f"List reservations successful. Found {len(list_data['items'])} upcoming reservation(s)")
        
        # Test 4: Get day view
        log_info(f"Getting day view for {future_date}")
        day_response = requests.get(
            f"{BASE_URL}/admin/reservations/day",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            params={"date": future_date},
            timeout=10
        )
        
        if day_response.status_code != 200:
            log_fail(f"Day view failed with status {day_response.status_code}", day_response.text)
            return False
        
        day_data = day_response.json()
        
        if "grid" not in day_data:
            log_fail("No grid in day view response", json.dumps(day_data, indent=2))
            return False
        
        log_pass(f"Day view successful. Grid has {len(day_data['grid'])} timeslots")
        
        # Test 5: Update reservation status
        log_info(f"Updating reservation {state.test_reservation_id} to confirmed")
        update_response = requests.patch(
            f"{BASE_URL}/admin/reservations/{state.test_reservation_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"status": "confirmed"},
            timeout=10
        )
        
        if update_response.status_code != 200:
            log_fail(f"Update reservation failed with status {update_response.status_code}", update_response.text)
            return False
        
        update_data = update_response.json()
        
        if "reservation" not in update_data:
            log_fail("No reservation in update response", json.dumps(update_data, indent=2))
            return False
        
        updated_res = update_data["reservation"]
        if updated_res.get("status") != "confirmed":
            log_fail(f"Status should be confirmed, got {updated_res.get('status')}")
            return False
        
        log_pass(f"Reservation updated successfully. Status: {updated_res.get('status')}")
        
        # Test 6: Cancel reservation (cleanup)
        log_info(f"Cancelling reservation {state.test_reservation_id}")
        cancel_response = requests.patch(
            f"{BASE_URL}/admin/reservations/{state.test_reservation_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"status": "cancelled"},
            timeout=10
        )
        
        if cancel_response.status_code == 200:
            log_pass("Reservation cancelled successfully")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during reservations test: {str(e)}")
        return False

def test_9_menu_management():
    """Test 9: Menu management CRUD"""
    log_test("9. Menu Management CRUD (CMS)")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    try:
        # Test 1: Get public menu
        log_info("Getting public menu")
        public_response = requests.get(f"{BASE_URL}/menu", timeout=10)
        
        if public_response.status_code != 200:
            log_fail(f"Get public menu failed with status {public_response.status_code}", public_response.text)
            return False
        
        public_menu = public_response.json()
        
        if not isinstance(public_menu, list):
            log_fail(f"Public menu should be a list, got {type(public_menu)}")
            return False
        
        log_pass(f"Public menu retrieved successfully. {len(public_menu)} items")
        
        # Test 2: Get menu version
        log_info("Getting menu version")
        version_response = requests.get(f"{BASE_URL}/menu/version", timeout=10)
        
        if version_response.status_code != 200:
            log_fail(f"Get menu version failed with status {version_response.status_code}", version_response.text)
            return False
        
        version_data = version_response.json()
        
        if "rev" not in version_data or "count" not in version_data:
            log_fail("Missing rev or count in version response", json.dumps(version_data, indent=2))
            return False
        
        initial_rev = version_data["rev"]
        log_pass(f"Menu version: rev={initial_rev}, count={version_data['count']}")
        
        # Test 3: Get admin menu
        log_info("Getting admin menu")
        admin_menu_response = requests.get(
            f"{BASE_URL}/admin/menu",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if admin_menu_response.status_code != 200:
            log_fail(f"Get admin menu failed with status {admin_menu_response.status_code}", admin_menu_response.text)
            return False
        
        admin_menu = admin_menu_response.json()
        log_pass(f"Admin menu retrieved successfully. {len(admin_menu)} items")
        
        # Test 4: Create menu item (pizza with prices map)
        log_info("Creating pizza menu item with prices map")
        create_pizza_response = requests.post(
            f"{BASE_URL}/admin/menu",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={
                "category": "pizzas",
                "name": "Test Pizza Autotest",
                "desc_fr": "Pizza de test automatique",
                "desc_en": "Automated test pizza",
                "ingredients_fr": "Tomate, mozzarella, test",
                "ingredients_en": "Tomato, mozzarella, test",
                "prices": {"26": 12.90, "31": 15.90},
                "image": "https://example.com/test.jpg"
            },
            timeout=10
        )
        
        if create_pizza_response.status_code not in [200, 201]:
            log_fail(f"Create pizza failed with status {create_pizza_response.status_code}", create_pizza_response.text)
            return False
        
        pizza_data = create_pizza_response.json()
        
        if "id" not in pizza_data:
            log_fail("No id in create pizza response", json.dumps(pizza_data, indent=2))
            return False
        
        pizza_id = pizza_data["id"]
        log_pass(f"Pizza created successfully. ID: {pizza_id}")
        
        # Test 5: Create non-pizza item (single price)
        log_info("Creating dessert menu item with single price")
        create_dessert_response = requests.post(
            f"{BASE_URL}/admin/menu",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={
                "category": "desserts",
                "name": "Test Dessert Autotest",
                "desc_fr": "Dessert de test",
                "desc_en": "Test dessert",
                "price": 6.50
            },
            timeout=10
        )
        
        if create_dessert_response.status_code not in [200, 201]:
            log_fail(f"Create dessert failed with status {create_dessert_response.status_code}", create_dessert_response.text)
            return False
        
        dessert_data = create_dessert_response.json()
        dessert_id = dessert_data.get("id")
        log_pass(f"Dessert created successfully. ID: {dessert_id}")
        
        state.test_menu_item_id = pizza_id
        
        # Test 6: Verify menu version incremented
        log_info("Verifying menu version incremented")
        new_version_response = requests.get(f"{BASE_URL}/menu/version", timeout=10)
        
        if new_version_response.status_code == 200:
            new_version_data = new_version_response.json()
            new_rev = new_version_data["rev"]
            
            if new_rev > initial_rev:
                log_pass(f"Menu version incremented: {initial_rev} -> {new_rev}")
            else:
                log_fail(f"Menu version did not increment: {initial_rev} -> {new_rev}")
        
        # Test 7: Update menu item
        log_info(f"Updating menu item {pizza_id}")
        update_response = requests.patch(
            f"{BASE_URL}/admin/menu/{pizza_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"name": "Test Pizza Updated", "desc_fr": "Pizza mise à jour"},
            timeout=10
        )
        
        if update_response.status_code != 200:
            log_fail(f"Update menu item failed with status {update_response.status_code}", update_response.text)
            return False
        
        update_data = update_response.json()
        if update_data.get("name") != "Test Pizza Updated":
            log_fail(f"Name not updated correctly. Got: {update_data.get('name')}")
            return False
        
        log_pass(f"Menu item updated successfully")
        
        # Test 8: Delete menu items (cleanup)
        log_info(f"Deleting test menu items")
        for item_id in [pizza_id, dessert_id]:
            delete_response = requests.delete(
                f"{BASE_URL}/admin/menu/{item_id}",
                headers={"Authorization": f"Bearer {state.admin_token}"},
                timeout=10
            )
            
            if delete_response.status_code == 200:
                log_pass(f"Menu item {item_id} deleted successfully")
            else:
                log_fail(f"Delete menu item {item_id} failed with status {delete_response.status_code}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during menu management test: {str(e)}")
        return False

def test_10_staff_management():
    """Test 10: Staff management"""
    log_test("10. Staff Management")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    try:
        # Test 1: Create staff member
        log_info("Creating staff member")
        create_response = requests.post(
            f"{BASE_URL}/admin/staff/create",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={
                "phone": "+33611223344",
                "name": "Test Staff Member",
                "role": "cashier"
            },
            timeout=10
        )
        
        if create_response.status_code not in [200, 201]:
            log_fail(f"Create staff failed with status {create_response.status_code}", create_response.text)
            return False
        
        create_data = create_response.json()
        
        if "created" not in create_data:
            log_fail("No created field in response", json.dumps(create_data, indent=2))
            return False
        
        staff_user = create_data["created"]
        staff_user_id = staff_user.get("user_id")
        state.test_staff_user_id = staff_user_id
        
        log_pass(f"Staff member created successfully. ID: {staff_user_id}, Role: {staff_user.get('role')}")
        
        # Test 2: List staff
        log_info("Listing staff members")
        list_response = requests.get(
            f"{BASE_URL}/admin/staff",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if list_response.status_code != 200:
            log_fail(f"List staff failed with status {list_response.status_code}", list_response.text)
            return False
        
        staff_list = list_response.json()
        
        if not isinstance(staff_list, list):
            log_fail(f"Staff list should be a list, got {type(staff_list)}")
            return False
        
        log_pass(f"Staff list retrieved successfully. {len(staff_list)} staff member(s)")
        
        # Test 3: Update role
        log_info(f"Updating role for staff {staff_user_id}")
        role_response = requests.patch(
            f"{BASE_URL}/admin/staff/{staff_user_id}/role",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"role": "staff"},
            timeout=10
        )
        
        if role_response.status_code != 200:
            log_fail(f"Update role failed with status {role_response.status_code}", role_response.text)
            return False
        
        role_data = role_response.json()
        if role_data.get("role") != "staff":
            log_fail(f"Role not updated correctly. Got: {role_data.get('role')}")
            return False
        
        log_pass(f"Role updated successfully to 'staff'")
        
        # Test 4: Disable staff
        log_info(f"Disabling staff {staff_user_id}")
        disable_response = requests.patch(
            f"{BASE_URL}/admin/staff/{staff_user_id}/disable",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"disabled": True},
            timeout=10
        )
        
        if disable_response.status_code != 200:
            log_fail(f"Disable staff failed with status {disable_response.status_code}", disable_response.text)
            return False
        
        disable_data = disable_response.json()
        if not disable_data.get("disabled"):
            log_fail("Staff member not disabled")
            return False
        
        log_pass(f"Staff member disabled successfully")
        
        # Test 5: Delete staff (cleanup)
        log_info(f"Deleting staff {staff_user_id}")
        delete_response = requests.delete(
            f"{BASE_URL}/admin/staff/{staff_user_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if delete_response.status_code != 200:
            log_fail(f"Delete staff failed with status {delete_response.status_code}", delete_response.text)
            return False
        
        log_pass(f"Staff member deleted successfully")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during staff management test: {str(e)}")
        return False

def test_11_statistics_dashboard():
    """Test 11: Statistics dashboard"""
    log_test("11. Statistics Dashboard")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    try:
        periods = ["today", "all"]
        
        for period in periods:
            log_info(f"Getting dashboard stats for period: {period}")
            response = requests.get(
                f"{BASE_URL}/admin/dashboard",
                headers={"Authorization": f"Bearer {state.admin_token}"},
                params={"period": period},
                timeout=10
            )
            
            if response.status_code != 200:
                log_fail(f"Dashboard request failed with status {response.status_code}", response.text)
                return False
            
            data = response.json()
            
            required_fields = [
                "period", "total_pizzas_sold", "loyalty_members", "vip_customers",
                "reservations_in_period", "rewards_redeemed", "top_customers", "top_pizzas"
            ]
            
            for field in required_fields:
                if field not in data:
                    log_fail(f"Missing field '{field}' in dashboard response", json.dumps(data, indent=2))
                    return False
            
            log_pass(f"Dashboard stats for '{period}' retrieved successfully")
            log_pass(f"  Total pizzas sold: {data['total_pizzas_sold']}")
            log_pass(f"  Loyalty members: {data['loyalty_members']}")
            log_pass(f"  VIP customers: {data['vip_customers']}")
            log_pass(f"  Reservations: {data['reservations_in_period']}")
            log_pass(f"  Rewards redeemed: {data['rewards_redeemed']}")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during dashboard test: {str(e)}")
        return False

def test_12_notifications():
    """Test 12: Notifications (web push endpoints)"""
    log_test("12. Notifications (Web Push)")
    
    try:
        # Test 1: Get VAPID public key (should return empty gracefully)
        log_info("Getting VAPID public key")
        key_response = requests.get(f"{BASE_URL}/push/web/public-key", timeout=10)
        
        if key_response.status_code != 200:
            log_fail(f"Get public key failed with status {key_response.status_code}", key_response.text)
            return False
        
        key_data = key_response.json()
        
        if "public_key" not in key_data:
            log_fail("No public_key in response", json.dumps(key_data, indent=2))
            return False
        
        public_key = key_data["public_key"]
        log_pass(f"VAPID public key retrieved: '{public_key}' (empty is expected in preview)")
        
        if not state.customer_token:
            log_info("No customer token, skipping authenticated push tests")
            return True
        
        # Test 2: Get push status
        log_info("Getting push status")
        status_response = requests.get(
            f"{BASE_URL}/push/web/status",
            headers={"Authorization": f"Bearer {state.customer_token}"},
            timeout=10
        )
        
        if status_response.status_code != 200:
            log_fail(f"Get push status failed with status {status_response.status_code}", status_response.text)
            return False
        
        status_data = status_response.json()
        log_pass(f"Push status retrieved: subscribed={status_data.get('subscribed')}, count={status_data.get('count')}")
        
        # Test 3: Test push (should not 500)
        log_info("Testing push notification")
        test_response = requests.post(
            f"{BASE_URL}/push/web/test",
            headers={"Authorization": f"Bearer {state.customer_token}"},
            timeout=10
        )
        
        if test_response.status_code == 500:
            log_fail(f"Push test returned 500 (should degrade gracefully)", test_response.text)
            return False
        
        if test_response.status_code == 200:
            test_data = test_response.json()
            log_pass(f"Push test completed: sent={test_data.get('sent')}")
        else:
            log_pass(f"Push test returned {test_response.status_code} (acceptable)")
        
        # Test 4: Register native push (should not 500)
        log_info("Testing native push registration")
        register_response = requests.post(
            f"{BASE_URL}/register-push",
            json={
                "user_id": "test_user",
                "platform": "android",
                "device_token": "test_token_12345"
            },
            timeout=10
        )
        
        if register_response.status_code == 500:
            log_fail(f"Register push returned 500 (should degrade gracefully)", register_response.text)
            return False
        
        if register_response.status_code in [200, 201]:
            register_data = register_response.json()
            log_pass(f"Native push registration: status={register_data.get('status')}")
        else:
            log_pass(f"Native push registration returned {register_response.status_code} (acceptable)")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during notifications test: {str(e)}")
        return False

def test_13_kiosk_ads():
    """Test 13: Kiosk mode + promotional slideshow"""
    log_test("13. Kiosk Mode + Promotional Slideshow (Ads)")
    
    if not state.admin_token:
        log_fail("No admin token available. Skipping test.")
        return False
    
    try:
        # Test 1: Get public slides
        log_info("Getting public slides")
        public_response = requests.get(f"{BASE_URL}/ads/slides", timeout=10)
        
        if public_response.status_code != 200:
            log_fail(f"Get public slides failed with status {public_response.status_code}", public_response.text)
            return False
        
        public_data = public_response.json()
        
        if "slides" not in public_data or "settings" not in public_data:
            log_fail("Missing slides or settings in response", json.dumps(public_data, indent=2))
            return False
        
        slides = public_data["slides"]
        settings = public_data["settings"]
        
        log_pass(f"Public slides retrieved successfully. {len(slides)} slide(s)")
        log_pass(f"Settings: idle_seconds={settings.get('idle_seconds')}, loop={settings.get('loop')}")
        
        # Verify slides are seeded across sections
        sections = set(s.get("section") for s in slides)
        expected_sections = {"loyalty", "experience", "ingredients"}
        
        if not expected_sections.issubset(sections):
            log_fail(f"Missing expected sections. Got: {sections}, Expected: {expected_sections}")
            return False
        
        log_pass(f"Slides seeded across sections: {sections}")
        
        # Test 2: Get admin slides
        log_info("Getting admin slides")
        admin_slides_response = requests.get(
            f"{BASE_URL}/admin/ads/slides",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if admin_slides_response.status_code != 200:
            log_fail(f"Get admin slides failed with status {admin_slides_response.status_code}", admin_slides_response.text)
            return False
        
        admin_slides_data = admin_slides_response.json()
        log_pass(f"Admin slides retrieved successfully. {len(admin_slides_data.get('slides', []))} slide(s)")
        
        # Test 3: Get admin settings
        log_info("Getting admin settings")
        admin_settings_response = requests.get(
            f"{BASE_URL}/admin/ads/settings",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if admin_settings_response.status_code != 200:
            log_fail(f"Get admin settings failed with status {admin_settings_response.status_code}", admin_settings_response.text)
            return False
        
        admin_settings = admin_settings_response.json()
        log_pass(f"Admin settings retrieved successfully")
        
        # Test 4: Create slide
        log_info("Creating new slide")
        create_response = requests.post(
            f"{BASE_URL}/admin/ads/slides",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={
                "section": "loyalty",
                "title": "Test Slide Autotest",
                "subtitle": "Automated test slide",
                "duration_ms": 5000,
                "active": True
            },
            timeout=10
        )
        
        if create_response.status_code not in [200, 201]:
            log_fail(f"Create slide failed with status {create_response.status_code}", create_response.text)
            return False
        
        create_data = create_response.json()
        
        if "id" not in create_data:
            log_fail("No id in create slide response", json.dumps(create_data, indent=2))
            return False
        
        slide_id = create_data["id"]
        state.test_slide_id = slide_id
        log_pass(f"Slide created successfully. ID: {slide_id}")
        
        # Test 5: Update slide
        log_info(f"Updating slide {slide_id}")
        update_response = requests.patch(
            f"{BASE_URL}/admin/ads/slides/{slide_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            json={"title": "Test Slide Updated", "active": False},
            timeout=10
        )
        
        if update_response.status_code != 200:
            log_fail(f"Update slide failed with status {update_response.status_code}", update_response.text)
            return False
        
        update_data = update_response.json()
        if update_data.get("title") != "Test Slide Updated":
            log_fail(f"Title not updated correctly. Got: {update_data.get('title')}")
            return False
        
        log_pass(f"Slide updated successfully")
        
        # Test 6: Reorder slides
        log_info("Testing slide reorder")
        # Get current slides to build reorder list
        current_slides = admin_slides_data.get("slides", [])
        if len(current_slides) > 0:
            slide_ids = [s["id"] for s in current_slides[:5]]  # Take first 5
            
            reorder_response = requests.put(
                f"{BASE_URL}/admin/ads/reorder",
                headers={"Authorization": f"Bearer {state.admin_token}"},
                json={"ids": slide_ids},
                timeout=10
            )
            
            if reorder_response.status_code != 200:
                log_fail(f"Reorder slides failed with status {reorder_response.status_code}", reorder_response.text)
                return False
            
            reorder_data = reorder_response.json()
            log_pass(f"Slides reordered successfully. {reorder_data.get('reordered')} slide(s)")
        
        # Test 7: Delete slide (cleanup)
        log_info(f"Deleting slide {slide_id}")
        delete_response = requests.delete(
            f"{BASE_URL}/admin/ads/slides/{slide_id}",
            headers={"Authorization": f"Bearer {state.admin_token}"},
            timeout=10
        )
        
        if delete_response.status_code != 200:
            log_fail(f"Delete slide failed with status {delete_response.status_code}", delete_response.text)
            return False
        
        log_pass(f"Slide deleted successfully")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during kiosk ads test: {str(e)}")
        return False

def test_14_auth_guarding():
    """Test 14: Auth guarding - verify admin-only endpoints reject customer token"""
    log_test("14. Auth Guarding (403 for customer, 401 for missing token)")
    
    if not state.customer_token:
        log_fail("No customer token available. Skipping test.")
        return False
    
    try:
        # Test admin-only endpoints with customer token (should get 403)
        admin_endpoints = [
            ("GET", f"{BASE_URL}/admin/menu"),
            ("GET", f"{BASE_URL}/admin/staff"),
            ("GET", f"{BASE_URL}/admin/dashboard"),
            ("GET", f"{BASE_URL}/admin/reservations"),
        ]
        
        for method, url in admin_endpoints:
            log_info(f"Testing {method} {url} with customer token (expect 403)")
            
            if method == "GET":
                response = requests.get(
                    url,
                    headers={"Authorization": f"Bearer {state.customer_token}"},
                    timeout=10
                )
            else:
                response = requests.post(
                    url,
                    headers={"Authorization": f"Bearer {state.customer_token}"},
                    json={},
                    timeout=10
                )
            
            if response.status_code != 403:
                log_fail(f"{method} {url} should return 403 for customer token, got {response.status_code}")
                return False
            
            log_pass(f"{method} {url} correctly returned 403 for customer token")
        
        # Test with missing token (should get 401)
        log_info(f"Testing GET {BASE_URL}/admin/menu without token (expect 401)")
        no_token_response = requests.get(f"{BASE_URL}/admin/menu", timeout=10)
        
        if no_token_response.status_code != 401:
            log_fail(f"Should return 401 for missing token, got {no_token_response.status_code}")
            return False
        
        log_pass(f"Correctly returned 401 for missing token")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during auth guarding test: {str(e)}")
        return False

def main():
    """Run all tests"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Pizza Denfert Loyalty Backend Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    tests = [
        ("1. Admin Login", test_1_admin_login),
        ("2. Customer OTP Auth", test_2_customer_otp_auth),
        ("3. Loyalty Card", test_3_loyalty_card),
        ("4. QR Code Scanning", test_4_qr_code_scanning),
        ("5. Loyalty Points Add/Remove", test_5_loyalty_points_add_remove),
        ("6. Rewards Redemption", test_6_rewards_redemption),
        ("7. Customer Search", test_7_customer_search),
        ("8. Reservations", test_8_reservations),
        ("9. Menu Management", test_9_menu_management),
        ("10. Staff Management", test_10_staff_management),
        ("11. Statistics Dashboard", test_11_statistics_dashboard),
        ("12. Notifications", test_12_notifications),
        ("13. Kiosk Ads", test_13_kiosk_ads),
        ("14. Auth Guarding", test_14_auth_guarding),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            log_fail(f"Unexpected exception in {name}: {str(e)}")
            results.append((name, False))
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    passed = sum(1 for _, result in results if result)
    failed = len(results) - passed
    
    for name, result in results:
        if result:
            print(f"{Colors.GREEN}✓ {name}{Colors.END}")
        else:
            print(f"{Colors.RED}✗ {name}{Colors.END}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Total: {len(results)} tests{Colors.END}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {failed}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
