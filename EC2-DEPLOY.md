# Vector DB Analyzer — EC2 Deployment Guide

## Step 1: Create EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Settings:
   - Name: `vector-db-analyzer`
   - AMI: **Ubuntu 22.04 LTS**
   - Instance type: **t3.small** (minimum)
   - Key pair: Create new → name it `fastapi-key` → download `.pem`
   - Storage: 20 GB gp3
3. Click **Launch Instance**

---

## Step 2: Connect to EC2

```bash
chmod 400 ~/Downloads/fastapi-key.pem
ssh -i ~/Downloads/fastapi-key.pem ubuntu@13.60.58.42
```

---

## Step 3: Install Docker

Run these one by one after connecting:

```bash
# a. Update packages
sudo apt-get update

# b. Install Docker
sudo apt-get install -y docker.io

# c. Start Docker
sudo systemctl start docker

# d. Enable Docker on boot
sudo systemctl enable docker

# e. Add user to docker group
sudo usermod -aG docker $USER

# f. Exit
exit
```

---

## Step 4: Reconnect to EC2

```bash
ssh -i ~/Downloads/fastapi-key.pem ubuntu@13.60.58.42
```

---

## Step 5: Pull and Run the App

```bash
# Pull backend image
docker pull ghcr.io/harimohan1990/vector_db_analyser/backend:latest

# Pull frontend image
docker pull ghcr.io/harimohan1990/vector_db_analyser/frontend:latest

# Create app directory
mkdir -p ~/vdb-app && cd ~/vdb-app

# Create .env file
cat > .env << 'EOF'
PINECONE_API_KEY=your_pinecone_key_here
OPENAI_API_KEY=your_openai_key_here
EOF

# Create docker-compose file
cat > docker-compose.yml << 'EOF'
services:
  backend:
    image: ghcr.io/harimohan1990/vector_db_analyser/backend:latest
    container_name: vdb-backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    image: ghcr.io/harimohan1990/vector_db_analyser/frontend:latest
    container_name: vdb-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
EOF

# Install docker-compose
sudo apt install docker-compose -y

# Start the app
docker-compose up -d

# Check containers are running
docker ps
```

---

## Step 6: Change Security Group Settings

1. Go to **AWS Console → EC2 → Instances → your instance**
2. Click **Security** tab → click the **Security Group** link
3. Click **Edit inbound rules** → **Add rule**:

| Type       | Port | Source    |
|------------|------|-----------|
| Custom TCP | 8000 | 0.0.0.0/0 |
| Custom TCP | 3000 | 0.0.0.0/0 |
| SSH        | 22   | My IP     |

4. Click **Save rules**

---

## Step 7: Check the API

Open in browser:

| URL | Description |
|-----|-------------|
| `http://13.60.58.42:8000/health` | Backend health check → `{"status":"ok"}` |
| `http://13.60.58.42:8000/docs` | Swagger API docs |
| `http://13.60.58.42:3000` | Frontend app |

Or test from terminal:
```bash
curl http://13.60.58.42:8000/health
```

---

## Step 8: Useful Commands

```bash
# View running containers
docker ps

# View logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Restart app
docker-compose restart

# Stop app
docker-compose down

# Pull latest images and redeploy
docker-compose pull && docker-compose up -d

# Check disk usage
df -h

# Check memory
free -h
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `connection refused` on port 8000/3000 | Check Security Group inbound rules |
| `docker: command not found` | Re-run Step 3 |
| `permission denied` on docker | Re-run Step 4 (reconnect after usermod) |
| Container not starting | Run `docker-compose logs backend` |
| Out of disk space | Run `docker system prune -f` |
| `.pem` permission denied | Run `chmod 400 fastapi-key.pem` |

---

## Auto-Deploy via GitHub Actions

Every push to `main` automatically:
1. Builds new Docker images
2. Pushes to GitHub Container Registry
3. SSHs into EC2 and redeploys

Required GitHub Secrets:
| Secret | Value |
|--------|-------|
| `EC2_HOST` | `13.60.58.42` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | contents of `fastapi-key.pem` |
| `PINECONE_API_KEY` | your Pinecone key |
| `OPENAI_API_KEY` | your OpenAI key |
| `VITE_API_URL` | `http://13.60.58.42:8000` |
