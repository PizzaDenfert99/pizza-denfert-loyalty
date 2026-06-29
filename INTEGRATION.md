# PizzaDenfert — Loyalty + Main App Integration

This single repository now contains **both apps + one backend**, integrated so the
**Loyalty Admin CMS is the only management panel** and every menu/price/category/
image/loyalty change flows to **both** apps automatically.

## Repository layout
```
/app
├── backend/          FastAPI + MongoDB — the SINGLE source of truth (+ Admin CMS API)
├── frontend/         Loyalty tablet app: Kiosk + QR Admin + Admin CMS  (loyalty.pizzadenfert.fr)
├── main-frontend/    Main customer app (your uploaded source, UNCHANGED structure)  (pizzadenfert.fr)
└── deploy/           One-command deploy scripts for the VPS
```

## How the integration works
- **One backend, one MongoDB.** The Loyalty backend is a superset of the main app's
  API (menu, auth, reservations, loyalty, admin, staff). Both frontends call it.
- **Main app points at the Loyalty backend** via `main-frontend/.env`
  → `EXPO_PUBLIC_BACKEND_URL=https://loyalty.pizzadenfert.fr`. CORS is open, so the
  customer site (different domain) can read it directly.
- **CMS is the only panel.** The Admin CMS lives in `frontend/` (`/admin`, `/admin-cms`).
  The main app's in-app admin entry button was removed (`main-frontend/app/(tabs)/account.tsx`).
- **Live updates without manual refresh.** The backend exposes `GET /api/menu/version`
  (a revision counter bumped on every CMS write). The customer menu screen auto-refreshes
  on focus, on app-foreground, and via a 20s poll — refetching only when the revision changed.
- **Shared accounts by phone.** Same backend/DB → one loyalty account per phone across both apps.

## Files changed for the integration
| Area | File | Change |
|------|------|--------|
| Backend | `backend/server.py` | `GET /api/menu/version` + `_bump_menu_rev()` called on menu create/update/delete |
| Backend | `backend/tests/test_menu_revision.py` | tests for the version signal |
| Main app | `main-frontend/.env` (+`.env.example`) | `EXPO_PUBLIC_BACKEND_URL=https://loyalty.pizzadenfert.fr` |
| Main app | `main-frontend/src/api.ts` | added `menuVersion()` |
| Main app | `main-frontend/app/(tabs)/menu.tsx` | auto-refresh (focus / 20s poll / foreground) + pull-to-refresh |
| Main app | `main-frontend/app/(tabs)/account.tsx` | removed in-app admin button (CMS is the only panel) |

> The main app's UI, navigation, screens, theme, and customer flows are otherwise **unchanged**.

## Deploy on the Hetzner VPS
The Loyalty backend + CMS are already deployed (see `deploy/deploy-fullstack.sh`).
Deploy the customer app at its own domain:

```bash
cd /root/pizza-denfert-loyalty
CUSTOMER_DOMAIN=pizzadenfert.fr EMAIL=ayatkarimi3411@gmail.com bash deploy/deploy-main-frontend.sh
```
This builds `main-frontend` (pointed at the Loyalty backend), serves it via Nginx at
`pizzadenfert.fr`, and issues a Let's Encrypt cert. After it runs:
- `https://pizzadenfert.fr` — customer app (menu auto-syncs from the CMS)
- `https://loyalty.pizzadenfert.fr` — Kiosk + Admin + **CMS** (the only management panel)

### Native APKs (optional)
Both apps build to APKs via Emergent **Publish**; `main-frontend` already points at the
Loyalty backend, so its APK shares the same live data.

## Verify the live sync
1. Open `https://pizzadenfert.fr/menu`.
2. In the CMS (`https://loyalty.pizzadenfert.fr/admin-cms`) change a price or add an item.
3. The customer menu updates within ~20s (or instantly when you re-focus the tab) — no reload.
