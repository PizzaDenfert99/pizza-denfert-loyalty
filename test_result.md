#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Loyalty tablet application for Pizza Denfert (restaurant staff, runs on in-store tablet).
  Imported from GitHub repo pizza-denfert-loyalty. This repo's backend/server.py is the CANONICAL
  shared Pizza Denfert FastAPI backend (MongoDB). The .env files were missing on import and were
  recreated (MONGO_URL local, DB_NAME=pizzadenfert, generated JWT_SECRET, OTP demo mode).
  Task: run a full end-to-end synchronization test of every backend feature and fix any issues.

backend:
  - task: "Admin login (email+password)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Seed admin admin@pizzadenfert.fr / Admin1234! (role owner). Verify /api/auth/login returns token+user with is_admin=true."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Admin login successful. POST /api/auth/login returns token and user with is_admin=true. GET /api/auth/me verified successfully with admin token."
  - task: "Customer OTP auth (demo mode)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/auth/otp/request returns dev_code (demo). /api/auth/otp/verify creates/logs in phone user, returns token+user."
        - working: true
          agent: "testing"
          comment: "✓ PASS: OTP auth working correctly. POST /api/auth/otp/request returns dev_code in demo mode. POST /api/auth/otp/verify creates customer account and returns token+user with is_admin=false."
  - task: "QR code scanning (admin/scan)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/admin/scan with qr_data PIZZA-DENFERT:{user_id}:{qr_token} returns customer loyalty payload. Get qr_data from a created customer's /api/loyalty/me."
        - working: true
          agent: "testing"
          comment: "✓ PASS: QR code scanning working. POST /api/admin/scan with qr_data returns customer loyalty payload with user_id, qr_token, pizza_count, available_rewards, and thresholds. QR data format PIZZA-DENFERT:{user_id}:{qr_token} verified."
  - task: "Loyalty points add/remove (admin/customer/add-pizza)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/admin/customer/add-pizza (positive adds, negative removes, clamp 0). Verify pizza_count changes and thresholds (coffee 3, dessert 5, margherita 10)."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Loyalty points add/remove working correctly. Positive values add pizzas, negative values remove (tested +10, -3, -20). Pizza count correctly clamped at 0. Available rewards computed correctly based on thresholds (coffee=3, dessert=5, margherita=10)."
  - task: "Rewards redemption (admin/customer/redeem)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/admin/customer/redeem after enough pizzas. Verify rewards_redeemed/history updates and available_rewards recompute."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Rewards redemption working. POST /api/admin/customer/redeem successfully redeems rewards and updates rewards_redeemed/history. Available_rewards recompute correctly after redemption. Customer self-redeem endpoint /api/loyalty/redeem also working."
  - task: "Customer accounts search"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/admin/search by phone or name returns matching customers."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Customer search working. POST /api/admin/search successfully searches by phone and by name, returning matching customer records with loyalty data."
  - task: "Reservations (availability, create, admin list/day/update)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/reservations/availability, POST /api/admin/reservations (auto table assign or waitlist), GET /api/admin/reservations, /api/admin/reservations/day, PATCH status/table."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Reservations fully working. GET /api/reservations/availability returns per-zone availability. POST /api/admin/reservations creates reservation with auto table assignment. GET /api/admin/reservations lists reservations with filters. GET /api/admin/reservations/day returns day grid view. PATCH /api/admin/reservations/{id} updates status and table assignment."
  - task: "Menu management CRUD (CMS)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET/POST/PATCH/DELETE /api/admin/menu. Verify menu/version rev bumps on writes. 21 items seeded."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Menu management CRUD working. GET /api/menu returns 21 seeded items. GET /api/menu/version returns rev and count. POST /api/admin/menu creates items (tested pizza with prices map and dessert with single price). PATCH /api/admin/menu/{id} updates items. DELETE /api/admin/menu/{id} deletes items. Menu version rev increments correctly on writes (0→2 after 2 creates)."
  - task: "Staff management"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/admin/staff/create, GET /api/admin/staff, PATCH role, PATCH disable, DELETE. Role-based permissions."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Staff management working. POST /api/admin/staff/create creates staff with role. GET /api/admin/staff lists all staff. PATCH /api/admin/staff/{user_id}/role updates role. PATCH /api/admin/staff/{user_id}/disable disables staff. DELETE /api/admin/staff/{user_id} deletes staff. Role-based permissions enforced."
  - task: "Statistics dashboard"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/admin/dashboard?period=today|week|month|all returns aggregated stats."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Statistics dashboard working. GET /api/admin/dashboard returns aggregated stats for all periods (today, all tested). Returns total_pizzas_sold, loyalty_members, vip_customers, reservations_in_period, rewards_redeemed, top_customers, and top_pizzas."
  - task: "Notifications (web push endpoints)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/push/web/public-key (VAPID empty in preview → returns empty), subscribe/status/test. Verify graceful behavior when VAPID not configured."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Notifications endpoints working and degrading gracefully. GET /api/push/web/public-key returns empty string (expected in preview). GET /api/push/web/status returns subscribed status. POST /api/push/web/test returns sent=0 (no 500 error). POST /api/register-push returns status=skipped (graceful degradation). All endpoints handle missing VAPID keys correctly without 500 errors."
  - task: "Kiosk mode + promotional slideshow (ads)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/ads/slides (public), admin CRUD /api/admin/ads/slides, reorder, /api/admin/ads/settings. Slides seeded across loyalty/experience/ingredients sections."
        - working: true
          agent: "testing"
          comment: "✓ PASS: Kiosk ads fully working. GET /api/ads/slides returns 14 seeded slides across all sections (loyalty, experience, ingredients) with settings. GET /api/admin/ads/slides and /api/admin/ads/settings work for admin. POST /api/admin/ads/slides creates slides. PATCH /api/admin/ads/slides/{id} updates slides. PUT /api/admin/ads/reorder reorders slides. DELETE /api/admin/ads/slides/{id} deletes slides."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Imported GitHub loyalty repo. Recreated missing .env files (backend local Mongo + generated JWT; frontend EXPO_PUBLIC_BACKEND_URL) and installed pywebpush. Backend healthy, 21 menu items + admin seeded. Please run a FULL end-to-end test of all backend features listed above. Admin creds: admin@pizzadenfert.fr / Admin1234!. OTP is in DEMO mode (dev_code returned in response). VAPID push keys are intentionally empty in preview — verify push endpoints degrade gracefully rather than 500. Fix nothing yourself; report failures with details."
    - agent: "testing"
      message: "✅ FULL END-TO-END BACKEND TEST COMPLETE - ALL 14 FEATURES PASSING. Comprehensive test suite created at /app/backend_test.py covering all requested features. Test results: (1) Admin login ✓ - email+password auth working, returns token+user with is_admin=true, GET /auth/me verified. (2) Customer OTP auth ✓ - demo mode working, dev_code returned in request response, verify creates customer account. (3) Loyalty card ✓ - GET /loyalty/me returns pizza_count, qr_data (format PIZZA-DENFERT:{user_id}:{qr_token}), thresholds (coffee=3, dessert=5, margherita=10). (4) QR scanning ✓ - POST /admin/scan with qr_data returns customer loyalty payload. (5) Loyalty points ✓ - add/remove working, positive adds, negative removes, correctly clamped at 0, available_rewards computed correctly. (6) Rewards redemption ✓ - admin redeem and customer self-redeem both working, history updates correctly. (7) Customer search ✓ - search by phone and name working. (8) Reservations ✓ - availability check, create with auto table assignment, list with filters, day grid view, update status/table all working. (9) Menu management ✓ - full CRUD working, pizza with prices map and non-pizza with single price both work, menu version rev increments on writes (0→2 verified). (10) Staff management ✓ - create, list, update role, disable, delete all working with role-based permissions. (11) Statistics dashboard ✓ - aggregated stats for all periods working (today, all tested). (12) Notifications ✓ - VAPID endpoints degrade gracefully with empty keys (no 500 errors), public-key returns empty string, status/test/register-push all handle missing config correctly. (13) Kiosk ads ✓ - 14 slides seeded across all sections (loyalty, experience, ingredients), full CRUD + reorder working. (14) Auth guarding ✓ - admin endpoints correctly return 403 for customer token and 401 for missing token. NO ISSUES FOUND. All endpoints behaving correctly. VAPID graceful degradation confirmed. Backend is production-ready."