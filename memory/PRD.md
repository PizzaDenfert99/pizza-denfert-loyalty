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
- P1: Connect this loyalty backend to the main customer app (shared `users` by phone — already compatible).
- P1: Activate real SMS (set SMS_PROVIDER + creds, restart backend).
- P2: Menu CMS bulk reorder; image compression for base64 slide/menu images.
- P2: Reservation timeline polish.

## Build (APK)
Use the Emergent **Publish** button (top-right). app.config.ts defaults to the loyalty variant so the generated APK is "Pizza Denfert · Fidélité" (package fr.pizzadenfert.loyalty). EAS CLI / external accounts are NOT used.
