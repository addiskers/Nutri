# Deployment Guide - NutriEyeQ Dashboard

This guide covers various deployment options for the NutriEyeQ Dashboard.

## Table of Contents
1. [Docker Compose (Local/VPS)](#docker-compose-localvps)
2. [Cloud Platform Deployment](#cloud-platform-deployment)
3. [SSL/HTTPS Setup](#sslhttps-setup)
4. [Environment Variables](#environment-variables)
5. [Troubleshooting](#troubleshooting)

---

## Docker Compose (Local/VPS)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ RAM
- Linux/Windows/Mac with ports 80, 443, 27017 available

### Deployment Steps

#### 1. Clone and Configure

```bash
cd Nutri

# Configure root environment
cp env.example .env
nano .env  # Update VITE_API_URL

# Configure backend environment
cd backend
cp env.example.txt .env
nano .env  # Update all required variables
cd ..
```

#### 2. Generate Secrets

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"
```

Add this to `backend/.env`:
```
SECRET_KEY=<generated-key>
```

#### 3. Deploy

```bash
# Build and start all services
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Check health
docker-compose ps
```

#### 4. Verify Deployment

```bash
# Test backend
curl http://localhost/api/health

# Test frontend
curl http://localhost
```

---

## Cloud Platform Deployment

### Option 1: DigitalOcean / Linode / Vultr (VPS)

**1. Create Droplet/VPS**
- Ubuntu 22.04 LTS
- 2GB RAM minimum (4GB recommended)
- SSH access enabled

**2. Initial Server Setup**

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create deploy user
adduser deploy
usermod -aG docker deploy
su - deploy
```

**3. Deploy Application**

```bash
# Clone repository
git clone <your-repo-url> nutrieyeq
cd nutrieyeq

# Configure environment files (as above)
cp env.example .env
cd backend && cp env.example.txt .env && cd ..

# Start services
docker-compose up -d
```

**4. Configure Firewall**

```bash
# UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Option 2: AWS ECS / Azure Container Apps

**AWS ECS Deployment:**

1. Create ECR repositories for frontend and backend
2. Build and push images:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Backend
cd backend
docker build -t nutrieyeq-backend .
docker tag nutrieyeq-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/nutrieyeq-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nutrieyeq-backend:latest

# Frontend
cd ../nutrieyeq-dashboard
docker build --build-arg VITE_API_URL=https://your-domain.com/api -t nutrieyeq-frontend .
docker tag nutrieyeq-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/nutrieyeq-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nutrieyeq-frontend:latest
```

3. Create ECS task definitions and services
4. Use AWS DocumentDB or MongoDB Atlas for database
5. Configure Application Load Balancer

### Option 3: Render / Railway

**Render:**

1. Create account at render.com
2. Create Web Services:
   - Backend: Docker, use `backend/Dockerfile`
   - Frontend: Docker, use `nutrieyeq-dashboard/Dockerfile`
3. Create MongoDB database (or use Atlas)
4. Set environment variables in Render dashboard
5. Deploy

**Railway:**

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Deploy: `railway up`

### Option 4: Vercel (Frontend) + Backend Separately

**Frontend on Vercel:**

```bash
cd nutrieyeq-dashboard
npm install -g vercel
vercel
```

**Backend on Render/Railway/Heroku:**
Deploy backend separately and update `VITE_API_URL` in Vercel environment variables.

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Recommended)

**1. Install Certbot**

```bash
sudo apt install certbot python3-certbot-nginx -y
```

**2. Obtain Certificates**

```bash
# Stop nginx temporarily
docker-compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Certificates saved to: /etc/letsencrypt/live/your-domain.com/
```

**3. Update nginx.conf**

Edit `nginx/nginx.conf` and uncomment the HTTPS section (lines 47-78), then update:
- `server_name your-domain.com;`

**4. Update docker-compose.yml**

Add SSL volume mount to nginx service:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/nginx/ssl:ro  # Add this line
```

**5. Restart Services**

```bash
docker-compose up -d
```

**6. Auto-Renewal**

```bash
# Test renewal
sudo certbot renew --dry-run

# Cron job for auto-renewal (runs twice daily)
echo "0 0,12 * * * root certbot renew --quiet && docker-compose restart nginx" | sudo tee -a /etc/crontab
```

### Using Cloudflare (Alternative)

1. Add domain to Cloudflare
2. Enable Full SSL/TLS encryption
3. Use Cloudflare Origin Certificates
4. Update DNS to point to your server

---

## Environment Variables

### Root .env
```bash
DATABASE_NAME=nutrieyeq
VITE_API_URL=https://your-domain.com/api  # Production URL
```

### Backend .env (Required Variables)

```bash
# Database
MONGODB_URL=mongodb://mongodb:27017  # Docker internal
DATABASE_NAME=nutrieyeq

# Security (CRITICAL - MUST CHANGE)
SECRET_KEY=<generate-with-python-secrets>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend URL
FRONTEND_URL=https://your-domain.com

# Gemini AI (Required for image extraction)
GEMINI_API_KEY=<your-gemini-api-key>

# Email (Optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@your-domain.com

# App Settings
APP_NAME=NutriEyeQ Dashboard
DEBUG=False  # Set to False in production
RATE_LIMIT_PER_MINUTE=60
```

---

## Production Checklist

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Set `DEBUG=False` in backend/.env
- [ ] Configure HTTPS/SSL certificates
- [ ] Set production `FRONTEND_URL` and `VITE_API_URL`
- [ ] Configure Gemini API key for product extraction
- [ ] Set up database backups
- [ ] Configure email for password resets
- [ ] Enable firewall (UFW/Security Groups)
- [ ] Set up monitoring (optional: Sentry, DataDog)
- [ ] Configure domain DNS records
- [ ] Test all functionality after deployment
- [ ] Set up automatic SSL renewal
- [ ] Configure rate limiting appropriately

---

## Database Backup

### Manual Backup

```bash
# Backup
docker-compose exec mongodb mongodump --db nutrieyeq --out /data/backup

# Copy to host
docker cp nutrieyeq-mongodb:/data/backup ./backup

# Restore
docker-compose exec mongodb mongorestore --db nutrieyeq /data/backup/nutrieyeq
```

### Automated Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T mongodb mongodump --db nutrieyeq --archive > backup_${DATE}.archive
find . -name "backup_*.archive" -mtime +7 -delete  # Keep 7 days
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /path/to/nutrieyeq/backup.sh" | crontab -
```

---

## Monitoring

### Health Checks

```bash
# Backend health
curl https://your-domain.com/api/health

# Check all containers
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

---

## Troubleshooting

### Container Won't Start

```bash
# View logs
docker-compose logs <service-name>

# Rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Issues

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker-compose exec backend python -c "from motor.motor_asyncio import AsyncIOMotorClient; print('OK')"
```

### Frontend Can't Connect to Backend

1. Check `VITE_API_URL` is set correctly in root `.env`
2. Rebuild frontend: `docker-compose up -d --build frontend`
3. Check nginx logs: `docker-compose logs nginx`

### Port Already in Use

```bash
# Find process using port 80
sudo lsof -i :80

# Or use different ports in docker-compose.yml
ports:
  - "8080:80"  # Use port 8080 instead
```

### SSL Certificate Issues

```bash
# Verify certificates exist
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Test nginx config
docker-compose exec nginx nginx -t

# Renew certificates
sudo certbot renew --force-renewal
```

---

## Scaling & Performance

### Enable MongoDB Replica Set (High Availability)

Update `docker-compose.yml` to use MongoDB replica set for production.

### Use MongoDB Atlas (Managed Database)

Replace local MongoDB with MongoDB Atlas:

```bash
# In backend/.env
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/nutrieyeq?retryWrites=true&w=majority
```

Remove mongodb service from `docker-compose.yml`.

### CDN for Frontend Assets

Use Cloudflare or AWS CloudFront to serve static frontend assets for better performance globally.

### Load Balancing

For multiple backend instances, update `nginx/nginx.conf`:

```nginx
upstream backend {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review this deployment guide
3. Check Docker/MongoDB documentation
