# Pizza Denfert — Loyalty Tablet App (PRD)

## Original Problem Statement
Existing project = the LOYALTY application for the restaurant tablet only (Admin + Kiosk + Loyalty Management). The main Pizza Denfert customer app exists separately and is NOT in scope. Task: do not rebuild; analyze existing code, fix bugs, complete missing parts, prepare for a stable Android APK. Keep OTP in DEMO MODE but production-ready (add SMS creds later, no rebuild). Shared customer model keyed by phone number. Backend configurable via env. Do not touch the user's production server/DB.

## Architecture
- Frontend: Expo (React Native + Web) SDK 54, expo-router, runs in LOYALTY mode by default (`src/appMode.ts`, `app.config.ts` variant=loyalty → APK package `fr.pizzadenfert.loyalty`).
- Backend: FastAPI + MongoDB (motor). JWT auth + phone OTP + Emergent Google OAuth. Web Push (VAPID) + Emergent native push relay (placeholder).
- Brand fonts (Playfair Display, Dancing Script) bundled locally via expo-font (no @expo-google-fonts). Icons via @expo/vector-icons (CDN prewarm for Expo Go).

## User Personas
- Customer: registers with phone (OTP), earns loyalty (pizzas → rewards), shows QR.
- Staff/Admin: logs in (email+password), scans QR, adjusts loyalty, manages menu/kiosk/reservations/staff/stats.

## Core Requirements (static)
1. Kiosk idle promo slideshow (admin-editable).
2. Customer registration via phone OTP (DEMO MODE; SMS-provider-ready).
3. Loyalty: 3 pizzas→café, 5→dessert, 10→Margherita. QR card.
4. Admin dashboard: QR scanner (native), customer search, add/remove pizzas, redeem.
5. Menu served from MongoDB + Menu CMS (add/edit/delete).
6. Shared customer model by phone (so main app can reuse same accounts).

## Implemented (2026-06-27)
- Migrated project into /app; backend MongoDB-backed and healthy.
- Removed Supabase entirely; menu now MongoDB. Added admin menu CRUD endpoints + MongoDB-backed Menu CMS screen.
- OTP DEMO MODE returns `dev_code` + `demo_mode`; added SMS abstraction (Twilio + OVH) toggled purely by env vars (SMS_PROVIDER + creds) — no code change/APK rebuild needed to go live.
- App forced to LOYALTY mode; brand fonts loaded locally; admin-ads image upload now stores base64 (no external bucket).
- Admin seed: admin@pizzadenfert.fr / Admin1234! (role owner).
- Verified end-to-end: kiosk, OTP registration→loyalty card, admin login→panel, menu CMS, ads admin. Testing agent: 14/14 backend pass, 100% frontend flows.

## Env Vars (backend/.env)
MONGO_URL, DB_NAME, JWT_SECRET, SMS_PROVIDER (""|twilio|ovh), OTP_DEMO_MODE,
TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER, OVH_APP_KEY/APP_SECRET/CONSUMER_KEY/SMS_SERVICE/SMS_SENDER.

## Backlog / Next
- P1: Activate real SMS (set SMS_PROVIDER + creds, restart backend).

## Deployment build fix (2026-07-04)
- EAS Android app-bundle build failed: "No lockfile found in the project directory. A lockfile is
  required..." → root cause: package.json pins packageManager yarn@1.22.22 but only package-lock.json
  existed (no yarn.lock). Fix (code-level): removed package-lock.json and generated yarn.lock
  (`yarn install --ignore-scripts`, 7414 lines). yarn.lock is NOT gitignored → included in deploy zip.
- Did NOT edit READ-ONLY supervisord.conf nor add tunnel env vars (deployment_agent generic
  suggestions) — unrelated to the build failure and would break the working preview.
- Verified: expo still bundles (HTTP 200) and frontend smoke test PASS (app loads, admin login OK,
  scanner primary) after the lockfile change.
- IMPORTANT CAVEAT: the Emergent build pipeline auto-rewrites EXPO_PUBLIC_BACKEND_URL to the
  emergent.host URL at build time (log showed -> https://tablet-qr-scanner.emergent.host). So an
  APK built via Emergent Publish points at the Emergent-hosted backend (+Atlas), NOT the VPS
  api.pizzadenfert.fr. If the tablet must hit the VPS, that URL override needs to be handled separately.
- P2: Menu CMS bulk reorder; image compression for base64 slide/menu images.
- P2: Reservation timeline polish.

## Re-import & full verification (2026-07-03)
- Re-imported from GitHub (pizza-denfert-loyalty). .env files were gitignored/missing → recreated:
  backend/.env (MONGO_URL local, DB_NAME=pizzadenfert, generated JWT_SECRET, OTP demo) and
  frontend/.env (EXPO_PUBLIC_BACKEND_URL=preview URL). Installed missing pywebpush dep.
- This repo's backend IS the canonical shared Pizza Denfert backend (see SYNC.md); loyalty tablet
  now runs the identical code/schema/collections the customer app uses. In production both apps share
  one VPS MongoDB + one JWT_SECRET.
- Full E2E: backend 14/14 PASS. Frontend UI: customer + admin flows PASS. Fixed 2 minor UI bugs
  (Menu CMS modal delete button off-screen; reservation create testIDs) — both verified by testing agent.
- VPS deploy TODO: identical JWT_SECRET across both apps, shared MONGO_URL/DB_NAME, tablet
  EXPO_PUBLIC_BACKEND_URL → production API domain.

## Build (APK)
Use the Emergent **Publish** button (top-right). app.config.ts defaults to the loyalty variant so the generated APK is "Pizza Denfert · Fidélité" (package fr.pizzadenfert.loyalty). EAS CLI / external accounts are NOT used.
