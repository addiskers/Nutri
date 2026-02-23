# NutriEyeQ Dashboard

A comprehensive nutrition tracking and product management dashboard with AI-powered product image extraction.

## Tech Stack

**Frontend:**
- React 19 with Vite
- TailwindCSS for styling
- Lucide React for icons
- Recharts for analytics
- React Router for navigation

**Backend:**
- FastAPI (Python)
- MongoDB with Beanie ODM
- JWT Authentication
- Google Gemini AI for product extraction
- Rate limiting and security features

**Infrastructure:**
- Docker & Docker Compose
- Nginx reverse proxy
- MongoDB database

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM available
- Ports 80, 443, and 27017 available

### Step 1: Configure Environment

1. **Backend configuration:**
   ```bash
   cd backend
   cp env.example.txt .env
   ```
   
   Edit `backend/.env` and update:
   - `SECRET_KEY` - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
   - `MONGODB_URL=mongodb://mongodb:27017` (for Docker)
   - `GEMINI_API_KEY` - Get from https://aistudio.google.com/app/apikey
   - Update other settings as needed

2. **Root configuration:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and update:
   - `VITE_API_URL` - Set to your domain/API URL

### Step 2: Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### Step 3: Access the Application

- **Frontend:** http://localhost
- **API Documentation:** http://localhost/api/docs
- **MongoDB:** localhost:27017

### Step 4: Create Admin User

After deployment, create your first admin user via the API or registration page.

## Development Mode

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp env.example.txt .env
# Edit .env with your settings
python run.py
```

### Frontend Development
```bash
cd nutrieyeq-dashboard
npm install
npm run dev
```

## Project Structure

```
Nutri/
├── backend/              # FastAPI backend
│   ├── app/             # Application code
│   ├── config/          # Configuration
│   ├── Dockerfile       # Backend container
│   └── requirements.txt # Python dependencies
├── nutrieyeq-dashboard/ # React frontend
│   ├── src/            # Source code
│   ├── Dockerfile      # Frontend container
│   └── package.json    # Node dependencies
├── nginx/              # Nginx configuration
│   └── nginx.conf      # Reverse proxy config
└── docker-compose.yml  # Orchestration config
```

## Available Services

- **mongodb** - MongoDB database server
- **backend** - FastAPI application server
- **frontend** - React SPA served by Nginx
- **nginx** - Reverse proxy and load balancer

## Management Commands

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v

# Rebuild services
docker-compose up -d --build

# View specific service logs
docker-compose logs -f backend

# Access backend shell
docker-compose exec backend sh

# Access MongoDB shell
docker-compose exec mongodb mongosh
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions including:
- SSL/HTTPS setup
- Domain configuration
- Security hardening
- Cloud platform deployment (AWS, Azure, DigitalOcean, etc.)
- CI/CD setup

## Features

- User authentication and authorization
- Product management with AI-powered image extraction
- Nutrition tracking and analytics
- Excel/CSV import/export
- Dashboard with charts and insights
- Rate limiting and security features

## License

Private Project
