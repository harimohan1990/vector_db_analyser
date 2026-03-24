# VectorDB Analyzer — Deployment Guide

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables](#3-environment-variables)
4. [Local Development](#4-local-development)
5. [Docker Deployment (Recommended)](#5-docker-deployment-recommended)
6. [Manual Production Deployment](#6-manual-production-deployment)
7. [Cloud Deployment](#7-cloud-deployment)
   - [Railway](#71-railway)
   - [Render](#72-render)
   - [Fly.io](#73-flyio)
   - [AWS EC2](#74-aws-ec2)
   - [Vercel + Render Split](#75-vercel--render-split)
8. [Nginx Reverse Proxy (Bare Metal)](#8-nginx-reverse-proxy-bare-metal)
9. [SSL / HTTPS](#9-ssl--https)
10. [Health Checks & Monitoring](#10-health-checks--monitoring)
11. [Updating the App](#11-updating-the-app)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture Overview

```
Browser
  │
  ├── :3000  →  Nginx (frontend container)
  │               ├── /          → React SPA (static files)
  │               └── /api/*     → proxy → Backend :8000
  │
  └── :8000  →  FastAPI (backend container)
                  └── SQLite  (./data/vdb.db)
```

| Component | Technology | Port |
|-----------|-----------|------|
| Frontend  | React 18 + Vite, served by Nginx | 3000 (→ 80 inside container) |
| Backend   | FastAPI + Uvicorn (4 workers) | 8000 |
| Database  | SQLite (query history, drift snapshots) | — |

---

## 2. Prerequisites

### For Docker deployment
- Docker >= 24.0
- Docker Compose >= 2.0
- 2 GB RAM minimum, 4 GB recommended

### For manual deployment
- Python 3.11+
- Node.js 20+
- npm 9+
- gcc (for some Python packages)

Check versions:
```bash
docker --version
docker compose version
python3 --version
node --version
```

---

## 3. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env   # if .env.example exists
# or create it manually:
```

```env
# ── Required ──────────────────────────────────────────────
OPENAI_API_KEY=sk-...          # Optional — only needed for OpenAI embeddings
                               # Leave empty to use free local 384D model

# ── Vector DB API Keys (add only what you use) ────────────
PINECONE_API_KEY=pcsk_...
QDRANT_API_KEY=...             # Only for Qdrant Cloud
WEAVIATE_API_KEY=...           # Only for Weaviate Cloud

# ── Optional overrides ────────────────────────────────────
# PYTHONUNBUFFERED=1           # Already set in Docker
# PORT=8000                    # Backend port (default: 8000)
```

> **Security:** Never commit `.env` to Git.
> Add it to `.gitignore`:
> ```bash
> echo ".env" >> .gitignore
> ```

---

## 4. Local Development

### Step 1 — Start the backend

```bash
# From project root
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
# API available at http://localhost:8000
# Docs at       http://localhost:8000/docs
```

### Step 2 — Start the frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:8000` automatically (configured in `vite.config.js`).

---

## 5. Docker Deployment (Recommended)

### Quick start

```bash
# Clone / navigate to project root
cd "VECTOR DB VISULIZER"

# Create your .env file (see Section 3)
cp .env .env   # edit with your keys

# Build and start
docker compose up --build

# Or run in background
docker compose up --build -d
```

| URL | What |
|-----|------|
| http://localhost:3000 | Frontend (React app) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/health | Health check endpoint |

### Stop

```bash
docker compose down          # stop containers
docker compose down -v       # also remove volumes (clears SQLite data)
```

### View logs

```bash
docker compose logs -f              # all services
docker compose logs -f backend      # backend only
docker compose logs -f frontend     # nginx only
```

### Rebuild after code changes

```bash
docker compose up --build -d
```

---

## 6. Manual Production Deployment

Use this when you want to run without Docker (e.g., on a VPS directly).

### Backend

```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt update && sudo apt install -y python3.11 python3.11-venv gcc curl

# Set up virtualenv
python3.11 -m venv /opt/vdb/venv
source /opt/vdb/venv/bin/activate
pip install -r requirements.txt

# Run with Gunicorn or Uvicorn (4 workers)
uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop \
  --http httptools \
  --no-access-log
```

### Run backend as a systemd service

```ini
# /etc/systemd/system/vdb-backend.service
[Unit]
Description=VectorDB Analyzer Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/vdb
EnvironmentFile=/opt/vdb/.env
ExecStart=/opt/vdb/venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 \
  --workers 4 --loop uvloop --http httptools
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable vdb-backend
sudo systemctl start vdb-backend
sudo systemctl status vdb-backend
```

### Frontend

```bash
cd frontend
npm install
npm run build
# Outputs to frontend/dist/

# Copy to web root
sudo cp -r dist/* /var/www/vdb/
```

---

## 7. Cloud Deployment

### 7.1 Railway

Railway can deploy both services from one repo.

1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add two services:

**Backend service:**
```
Root Directory: /  (project root)
Build Command:  pip install -r requirements.txt
Start Command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
Add environment variables from your `.env`.

**Frontend service:**
```
Root Directory: /frontend
Build Command:  npm install && npm run build
Start Command:  (static — set output dir to dist/)
```
Set `VITE_API_URL` to the Railway backend URL (e.g., `https://vdb-backend.up.railway.app`).

---

### 7.2 Render

**Backend (Web Service):**
```
Environment:    Python 3
Build Command:  pip install -r requirements.txt
Start Command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Frontend (Static Site):**
```
Root Directory: frontend
Build Command:  npm install && npm run build
Publish Dir:    dist
```
Add environment variable: `VITE_API_URL=https://your-backend.onrender.com`

> **Note:** Free tier on Render spins down after 15 min of inactivity. Use paid tier for always-on.

---

### 7.3 Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy backend
fly launch --name vdb-backend --dockerfile Dockerfile
fly secrets set OPENAI_API_KEY=sk-... PINECONE_API_KEY=pcsk_...
fly deploy

# Deploy frontend
cd frontend
fly launch --name vdb-frontend --dockerfile Dockerfile
fly deploy
```

---

### 7.4 AWS EC2

```bash
# 1. Launch EC2 instance (Ubuntu 22.04, t3.small minimum)
# 2. Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000, 8000

# 3. SSH in and install Docker
ssh -i your-key.pem ubuntu@<EC2-IP>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# 4. Clone repo
git clone https://github.com/yourname/vector-db-visualizer.git
cd vector-db-visualizer

# 5. Set up .env and deploy
nano .env   # add your keys
docker compose up --build -d
```

Access at `http://<EC2-IP>:3000`

---

### 7.5 Vercel + Render Split

Best for free tier — frontend on Vercel (global CDN), backend on Render.

**Frontend on Vercel:**
```bash
cd frontend
npx vercel

# When prompted:
# Framework: Vite
# Build: npm run build
# Output: dist
```
Add env var in Vercel dashboard:
```
VITE_API_URL = https://your-backend.onrender.com
```

**Backend on Render:** (see Section 7.2)

---

## 8. Nginx Reverse Proxy (Bare Metal)

If deploying manually on a VPS, use Nginx to serve everything on port 80/443.

```nginx
# /etc/nginx/sites-available/vdb
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend static files
    root /var/www/vdb;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend
    location /api/ {
        proxy_pass         http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vdb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL / HTTPS

### Using Certbot (Let's Encrypt) — Free

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
```

### Using Cloudflare (Zero Config)

1. Point your domain to Cloudflare
2. Set DNS A record → your server IP
3. Enable "Proxied" (orange cloud)
4. SSL/TLS → Full (strict)

Cloudflare handles HTTPS automatically, no certificates to manage.

---

## 10. Health Checks & Monitoring

### Backend health endpoint

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

The Docker healthcheck polls this every 30s. The frontend container waits for it before starting (`depends_on: condition: service_healthy`).

### Check container status

```bash
docker compose ps
docker stats          # live CPU/RAM usage
```

### Check backend logs for errors

```bash
docker compose logs backend --tail=50
```

### Uptime monitoring (free)

- [UptimeRobot](https://uptimerobot.com) — ping `https://yourdomain.com/api/health` every 5 min, email on down
- [Betterstack](https://betterstack.com) — more detailed

---

## 11. Updating the App

### With Docker

```bash
git pull
docker compose up --build -d
```

This rebuilds changed layers only (Docker cache is used for unchanged layers, so it's fast).

### Without Docker

```bash
git pull

# Backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart vdb-backend

# Frontend
cd frontend
npm install
npm run build
sudo cp -r dist/* /var/www/vdb/
```

---

## 12. Troubleshooting

### Backend won't start

```bash
docker compose logs backend
```

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` again |
| `Address already in use :8000` | `lsof -i :8000` then kill the process |
| `PINECONE_API_KEY not set` | Add key to `.env` file |

### Frontend shows blank page

```bash
docker compose logs frontend
```

| Error | Fix |
|-------|-----|
| `connect ECONNREFUSED` | Backend not running — check `docker compose ps` |
| 404 on refresh | Nginx SPA config missing — check `nginx.conf` has `try_files` |
| Old version showing | Hard refresh: `Cmd+Shift+R` / clear browser cache |

### Pinecone dimension mismatch error

The index was created with a different embedding dimension than what you're querying with.

- Local model → 384D
- OpenAI `text-embedding-3-small` → 1536D
- OpenAI `text-embedding-3-large` → 3072D

Use the **Vector Playground** (⚡ Generate button) to test with the right dimension before querying.

### Docker build fails

```bash
# Clear Docker cache and rebuild from scratch
docker compose build --no-cache
```

### Port already in use

```bash
# Find what's using port 3000 or 8000
lsof -i :3000
lsof -i :8000

# Change ports in docker-compose.yml if needed:
# "3001:80"  instead of  "3000:80"
```

### SQLite data persisted between rebuilds?

Yes — the `./data` folder is mounted as a volume in `docker-compose.yml`:
```yaml
volumes:
  - ./data:/app/data
```
Rebuilding the image does **not** delete your data. Only `docker compose down -v` removes it.

---

*Generated for VectorDB Analyzer v1.0 — March 2026*
