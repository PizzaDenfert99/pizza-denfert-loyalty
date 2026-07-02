# PizzaDenfert — Integration Overview

This document explains how the two Pizza Denfert applications integrate around
**one shared backend, one MongoDB, and one Supabase project** so that every
menu / price / category / image / loyalty change flows to both apps
automatically. For the source-code synchronisation contract between the two
repositories, see [`SYNC.md`](./SYNC.md).

## Two repositories, one system

| Role                          | Repository                                          | Contents                                                                                             |
| ----------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Loyalty / POS / Admin CMS     | `PizzaDenfert99/pizza-denfert-loyalty` (this repo)  | `backend/` (**canonical FastAPI**), `frontend/` (Kiosk + QR admin + Admin CMS), `deploy/` (VPS scripts) |
| Customer app (public site)    | `PizzaDenfert99/denfert-pizzeria`                   | `frontend/` (Expo customer app), `backend/` (mirror of the canonical backend, preview-only)          |

The customer-facing app used to live in a `main-frontend/` folder inside this
repo. That folder has been removed (2026-06-30 sync) and the customer app now
lives exclusively in the `denfert-pizzeria` repo.

## Repository layout (this repo)

```
pizza-denfert-loyalty/
├── backend/          FastAPI + MongoDB + Supabase — the SINGLE source of truth (+ Admin CMS API)
├── frontend/         Loyalty tablet app: Kiosk + QR Admin + Admin CMS  (loyalty.pizzadenfert.fr)
├── deploy/           One-command deploy scripts for the Hetzner VPS
└── SYNC.md           Cross-repo sync contract
```

## How the integration works

- **One backend, one MongoDB, one Supabase project.** The Loyalty backend is a
  superset of the customer app's API (menu, auth, reservations, loyalty, admin,
  staff, push, kiosk/ads). Both frontends call it.
- **Customer app points at the Loyalty backend** via
  `denfert-pizzeria/frontend/.env` →
  `EXPO_PUBLIC_BACKEND_URL=https://loyalty.pizzadenfert.fr`. CORS is open, so
  the customer site (different domain) can read it directly.
- **Web browsers on `pizzadenfert.fr`** are also served by the same backend via
  the mirror domain `https://api.pizzadenfert.fr` (see
  `frontend/src/api.ts` in either repo).
- **Menu / CMS data lives in Supabase.** Project
  `fuxyinngmdzzoumloenv.supabase.co` is consumed by both apps for the customer
  menu and the Admin CMS. The backend also keeps a MongoDB copy of the menu as
  a fallback for the legacy `/api/menu` route and for popularity analytics.
- **The Admin CMS is the only management panel.** It lives in
  `frontend/` (`/admin`, `/admin-cms`) inside this repo. The customer app has
  no admin UI — customers only see menu, reservations, and loyalty.
- **Live updates without manual refresh.** The backend exposes
  `GET /api/menu/version` (a revision counter bumped on every CMS write). The
  customer menu screen auto-refreshes on focus, on app-foreground, and via a
  20-second poll — refetching only when the revision changes.
- **Shared accounts by phone.** Same backend and same MongoDB → one loyalty
  account per phone across both apps.

## Environment contract

Every environment variable is documented in `backend/.env.example` and
`frontend/.env.example` in **both** repos. The two `.env.example` files must
stay identical (see `SYNC.md`).

| Variable                        | Where             | Purpose                                          |
| ------------------------------- | ----------------- | ------------------------------------------------ |
| `MONGO_URL`, `DB_NAME`          | backend `.env`    | Local MongoDB on the VPS                          |
| `JWT_SECRET`                    | backend `.env`    | Signs the customer + admin JWTs                   |
| `SUPABASE_URL`                  | backend `.env`    | `https://fuxyinngmdzzoumloenv.supabase.co`        |
| `SUPABASE_SERVICE_ROLE_KEY`     | backend `.env`    | Server-side CMS writes (kept secret)              |
| `SMS_PROVIDER` / Twilio / OVH   | backend `.env`    | Optional — empty = OTP demo mode                  |
| `VAPID_*`                       | backend `.env`    | Optional — enables browser push                   |
| `EMERGENT_PUSH_KEY`             | backend `.env`    | Optional — enables native push relay              |
| `EXPO_PUBLIC_BACKEND_URL`       | frontend `.env`   | `https://loyalty.pizzadenfert.fr`                 |
| `EXPO_PUBLIC_SUPABASE_URL`      | frontend `.env`   | Same Supabase project as backend                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | frontend `.env`   | Public anon key (safe in the client bundle)       |

Real values live only in each server's local `.env`. Never committed.

## Deploy on the Hetzner VPS

Only this repo (`pizza-denfert-loyalty`) is deployed to the VPS. The customer
app is built and hosted separately (currently via the Emergent Publish button)
and simply talks HTTPS to the loyalty backend.

```bash
# From a fresh checkout on the VPS
cd /root/pizza-denfert-loyalty
sudo DOMAIN=api.pizzadenfert.fr EMAIL=you@email.com bash deploy/deploy.sh
```

After it runs:
- `https://api.pizzadenfert.fr` — canonical backend host (used by
  `pizzadenfert.fr` browsers).
- `https://loyalty.pizzadenfert.fr` — Kiosk + Admin + **CMS** (the only
  management panel).

### Native APKs

Both apps build to APKs via the Emergent **Publish** button. Each APK ships
with `EXPO_PUBLIC_BACKEND_URL=https://loyalty.pizzadenfert.fr` baked in, so
they share the same live data as the web sites.

## Verify the live sync

1. Open `https://pizzadenfert.fr/menu` (customer app).
2. In the CMS (`https://loyalty.pizzadenfert.fr/admin-cms`) change a price or
   add a menu item.
3. The customer menu updates within ~20 s (or instantly when you re-focus the
   tab) — no reload required.

## Making backend or shared changes

**Always** follow the workflow in `SYNC.md`:

1. Change the backend code in this repo.
2. Copy the changed files to `denfert-pizzeria/backend/` byte-for-byte.
3. Open a PR on the same branch name in both repos.
4. Merge both PRs together to keep the repos in lock-step.
5. Deploy to the VPS by pulling the merged `main` of THIS repo.
