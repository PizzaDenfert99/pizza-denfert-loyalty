# Deploying Pizza Denfert Loyalty on your own Ubuntu server (Hetzner)

This app is a **mobile app** (Expo). The server only needs to host the **backend API**
(FastAPI + MongoDB). The customer/admin/kiosk UI ships as the **Android APK** built
via the Emergent **Publish** button, configured to point at this server's HTTPS URL.

`deploy/deploy.sh` automates steps 4–10 of your request in **one command**.

---

## Step 1 — Find your repo URL & fix the password prompt

The HTTPS clone keeps asking for a username/password because the repository is
**PRIVATE** (public repos never prompt). Find the exact URL: GitHub → your repo →
green **Code** button. Then pick ONE method:

### Option A — SSH deploy key (recommended)
```bash
ssh-keygen -t ed25519 -C "hetzner-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Paste that key in GitHub → your repo → Settings → Deploy keys → Add deploy key (read-only).
ssh -T git@github.com            # expect: "Hi USER/REPO! You've successfully authenticated"
git clone git@github.com:USER/REPO.git /opt/pizzadenfert
```

### Option B — Personal Access Token (PAT) over HTTPS
GitHub → Settings → Developer settings → Fine-grained tokens → create one with
**Contents: Read** for this repo, then:
```bash
git clone https://USER:YOUR_PAT@github.com/USER/REPO.git /opt/pizzadenfert
```

### Option C — No GitHub at all (Emergent "Download code")
Download the project zip from Emergent, then upload it to the server:
```bash
scp pizzadenfert.zip root@SERVER_IP:/opt/   # run on your laptop
ssh root@SERVER_IP "cd /opt && unzip pizzadenfert.zip -d pizzadenfert"
```

---

## Step 2 — Point DNS at the server
Create an **A record** for `api.yourdomain.com` → your Hetzner server's public IPv4.
(Required before SSL / Let's Encrypt can issue a certificate.)

---

## Step 3 — Run the automated deploy (one command)
```bash
cd /opt/pizzadenfert
sudo DOMAIN=api.yourdomain.com EMAIL=you@email.com bash deploy/deploy.sh
```
This installs Node/Python/Nginx/Docker, runs MongoDB, installs backend deps,
writes `backend/.env` (auto-generated `JWT_SECRET`), creates a **systemd** service
(`pizzadenfert`) that **auto-starts on reboot**, configures **Nginx**, issues
**Let's Encrypt SSL**, and verifies `/api/healthz`.

---

## Step 4 — Build & point the APK
In Emergent, set the app's backend URL to `https://api.yourdomain.com`, build the
Android APK via **Publish**, and install it on the tablet.

---

## Day-2 operations
```bash
sudo systemctl restart pizzadenfert      # restart API (e.g. after editing .env)
sudo systemctl status  pizzadenfert      # service health
journalctl -u pizzadenfert -f            # live logs
# Update to latest code:
cd /opt/pizzadenfert && git pull && \
  backend/.venv/bin/pip install -r backend/requirements.txt && \
  sudo systemctl restart pizzadenfert
```

### Enable real SMS later (no APK rebuild)
Edit `backend/.env`, set `SMS_PROVIDER=twilio` (or `ovh`) + the matching
credentials, then `sudo systemctl restart pizzadenfert`. OTP leaves demo mode
automatically — no code change, no rebuild.
