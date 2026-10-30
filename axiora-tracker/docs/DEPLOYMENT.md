# Deploying to production

## Live deployment: https://axioralabs.ai/qa/ (PHP, Hostinger shared hosting)

The production instance runs the **PHP backend** (`php/`), a port of the Node backend that keeps the same schema, rules, API and frontend. That's because the Hostinger plan runs PHP 8.3 but cannot keep a Node.js process alive. It lives beside the WordPress site without touching it:

| Path on the server | Contents |
|---|---|
| `~/axiora-tracker/` | App code (`php/`, `migrations/`, `public/`) and `.env`. **Outside the web root** |
| `~/axiora-tracker/data/` | `tracker.db` (SQLite) and `uploads/`. **Back this folder up** |
| `~/domains/axioralabs.ai/public_html/qa/` | `index.php` (loads the app), `.htaccess`, and copies of `public/css`, `public/js`, `favicon.svg` |

WordPress's root `.htaccess` only rewrites missing files and folders, so everything under `/qa/` is handled by this folder's own `.htaccess` and never reaches WordPress. Responses send `Cache-Control: no-store` and `X-LiteSpeed-Cache-Control: no-cache`, so LiteSpeed never caches signed-in pages.

**Updating the live app**

1. Run `npm test` and `PHP_BIN=/path/to/php npm run test:php`. Both must pass.
2. Build `dist/axiora-tracker-php.tar.gz` with `php/`, `migrations/` and `public/`, using forward-slash paths.
3. Upload it, back up `~/axiora-tracker/data`, extract it over `~/axiora-tracker`, and copy `public/css` and `public/js` into `public_html/qa/`.
4. Run `php ~/axiora-tracker/php/cli.php migrate`.

`.env` and `data/` are never part of the package.

**Maintenance commands** (run on the server; passwords are read from the `AXT_PASSWORD` environment variable):

```bash
php ~/axiora-tracker/php/cli.php migrate
AXT_PASSWORD='…' php ~/axiora-tracker/php/cli.php create-user --name "Name" --email someone@axioralabs.ai --role admin
AXT_PASSWORD='…' php ~/axiora-tracker/php/cli.php set-password --email someone@axioralabs.ai
```

**Local PHP run:** `npm run dev:php`, then open http://127.0.0.1:8080/qa/.

---

## Node.js deployment (VPS or Node-capable hosting)

The tracker is a single Node.js process with a local SQLite database and an uploads folder. Any Linux server or VPS that can run **Node.js 22.13+** and keep a process alive will work.

> **Hosting note.** Standard shared web hosting that only runs PHP (as used for the WordPress marketing site) cannot run this app. Use a VPS, or a hosting plan with Node.js application support. Keep the tracker on a separate subdomain (for example `tracker.axioralabs.ai`) and never inside the WordPress directory.

## 1. Install

```bash
sudo adduser --system --group axiora-tracker
sudo mkdir -p /opt/axiora-tracker && sudo chown axiora-tracker: /opt/axiora-tracker
# copy the project (without node_modules/ and data/) to /opt/axiora-tracker, then:
cd /opt/axiora-tracker
npm ci --omit=dev
cp .env.example .env
```

Edit `.env`:

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/var/lib/axiora-tracker
TRUST_PROXY=true
COOKIE_SECURE=true
ADMIN_EMAIL=you@axioralabs.ai
ADMIN_PASSWORD=<a long temporary password>
ADMIN_NAME=Your Name
```

```bash
sudo mkdir -p /var/lib/axiora-tracker && sudo chown axiora-tracker: /var/lib/axiora-tracker
sudo chmod 600 /opt/axiora-tracker/.env
sudo -u axiora-tracker npm run migrate
```

## 2. Run as a service (systemd)

`/etc/systemd/system/axiora-tracker.service`:

```ini
[Unit]
Description=Axiora Change & Defect Tracker
After=network.target

[Service]
User=axiora-tracker
WorkingDirectory=/opt/axiora-tracker
ExecStart=/usr/bin/node server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/axiora-tracker

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now axiora-tracker
journalctl -u axiora-tracker -f      # should print "Created initial admin account …"
```

Sign in once, then **remove `ADMIN_PASSWORD` from `.env`** and change the password from the key icon in the top bar.

(pm2 also works: `pm2 start server.js --name axiora-tracker && pm2 save`.)

## 3. HTTPS reverse proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name tracker.axioralabs.ai;
    # ssl_certificate / ssl_certificate_key from certbot

    client_max_body_size 110m;   # MAX_UPLOAD_MB × MAX_FILES_PER_UPLOAD, plus margin

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server { listen 80; server_name tracker.axioralabs.ai; return 301 https://$host$request_uri; }
```

`TRUST_PROXY=true` lets the app detect HTTPS for the Secure cookie flag.

## 4. Backups

Everything lives in `DATA_DIR`. Copy the database with SQLite's online backup so you never capture a half-written file:

```bash
# nightly cron, as the service user
sqlite3 /var/lib/axiora-tracker/tracker.db ".backup '/backups/tracker-$(date +%F).db'"
rsync -a /var/lib/axiora-tracker/uploads/ /backups/uploads/
```

To restore, stop the service, put `tracker.db` and `uploads/` back in place, then start the service.

## 5. Upgrading

```bash
sudo systemctl stop axiora-tracker
# back up DATA_DIR (see above), then replace the code
npm ci --omit=dev
npm run migrate          # also runs automatically on start
sudo systemctl start axiora-tracker
```

## 6. Health check

`GET /healthz` returns `{"ok":true}` without authentication, for uptime monitors.

## Checklist

- [ ] `NODE_ENV=production` (demo data cannot be loaded)
- [ ] Served over HTTPS only, with `COOKIE_SECURE=true` and `TRUST_PROXY=true`
- [ ] `ADMIN_PASSWORD` removed from `.env` after first start
- [ ] `.env` readable only by the service user
- [ ] `DATA_DIR` backed up nightly and a restore tested once
- [ ] Products, modules and user accounts created in the app
