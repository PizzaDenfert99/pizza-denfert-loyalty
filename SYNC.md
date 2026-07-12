# Repository Synchronisation Contract

Pizza Denfert is served by **two GitHub repositories** that MUST stay in
lock-step at the source-code level:

| Role | Repo | What lives here |
| --- | --- | --- |
| Customer app (public site + native app) | `PizzaDenfert99/denfert-pizzeria` | `frontend/` (Expo customer app), `backend/` (mirror of the canonical FastAPI backend for local Emergent preview) |
| Loyalty / POS / Admin CMS | `PizzaDenfert99/pizza-denfert-loyalty` (THIS repo) | `frontend/` (Expo loyalty/kiosk/CMS), `backend/` (**canonical** FastAPI backend — one source of truth), `deploy/` (Hetzner + Nginx + systemd scripts) |

## Single source of truth

- **`backend/server.py`** — this repo is authoritative. When you change an
  endpoint here, sync the exact same file into `denfert-pizzeria/backend/server.py`
  on a `sync/*` branch and open a PR against `main`.
- **`backend/requirements.txt`** — same rule.
- **Supabase project** — a single Supabase project (`fuxyinngmdzzoumloenv.supabase.co`)
  is consumed by both apps. Keys live only in each server's local `.env`.
- **MongoDB** — a single MongoDB running on the Hetzner VPS (bound to 127.0.0.1)
  is consumed by the shared backend, hence by both apps.

## What lives in which repo — never duplicate

- The backend code exists in **both** repos as identical files. The customer
  repo copy exists **only** to let the Emergent preview run a local backend;
  in production only the loyalty repo's `backend/` is deployed to the VPS.
- Any customer-app frontend code lives **only** in the `denfert-pizzeria` repo.
  The old `main-frontend/` folder inside this repo has been removed as part of
  this sync (2026-06-30) — the customer app now has its own dedicated repo.
- Deploy scripts (`deploy/`) live only in this repo. The customer app is a
  pure client — it does not deploy servers.

## Sync workflow (do this every time you touch the backend)

1. Change the code in `pizza-denfert-loyalty/backend/`.
2. Create branch `sync/<short-description>` in both repos.
3. Copy the modified files into the customer repo's `backend/`.
4. Open a PR against `main` in each repo. Do **not** push directly to `main`.
5. Merge both PRs together to keep the repos in lock-step.
6. Deploy to the VPS by pulling the merged `main` of THIS repo (not the customer one).

## Environment variables (canonical set)

See `backend/.env.example` and `frontend/.env.example` for the full list. In
short:

- `MONGO_URL`, `DB_NAME`, `JWT_SECRET` — required for the API to boot.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required for the CMS-seed
  endpoint (`POST /api/admin/cms/seed-from-mongo`). Frontend uses the anon key.
- `SMS_PROVIDER` / Twilio / OVH — optional; empty = OTP demo mode.
- `VAPID_*` — optional; enables browser push notifications.
- `EMERGENT_PUSH_KEY` — optional; enables native push relay via Emergent.

Production `.env` files are managed on the VPS by `deploy/make-env.sh` and
`deploy/deploy.sh`. They are **never** committed.
