# 🚀 SATHA CHOICE - PRODUCTION DEPLOYMENT GUIDE

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ System Requirements
- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ running
- [ ] Minimum 2GB RAM
- [ ] Port 5000 open (or custom PORT from .env)
- [ ] SSL Certificate (for HTTPS - recommended)

---

## 🔧 STEP 1: SERVER SETUP

### 1.1 Clone Repository
```bash
git clone <your-repo-url>
cd Satha-Choice
```

### 1.2 Install Dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 1.3 Configure Environment Variables

#### Server Configuration (.env)
```bash
# Copy production template
cp .env.production .env

# Edit with your actual details
nano .env
```

**Update these values:**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/satha_choice
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
SESSION_SECRET=<generate-secure-random-string>
```

**Generate secure session secret:**
```bash
openssl rand -base64 32
```

#### Client Configuration (client/.env.production)
```bash
cd client
nano .env.production
```

**Update these values:**
```env
VITE_API_URL=https://yourdomain.com
VITE_SOCKET_URL=https://yourdomain.com
VITE_NODE_ENV=production
```

---

## 🗄️ STEP 2: DATABASE SETUP

### 2.1 Create Database
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE satha_choice;

# Create user (if needed)
CREATE USER satha_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE satha_choice TO satha_user;

\q
```

### 2.2 Run Migrations
```bash
npm run db:push
```

---

## 🏗️ STEP 3: BUILD APPLICATION

### 3.1 Build Client
```bash
cd client
npm run build
cd ..
```

This creates an optimized production build in `client/dist/`.

### 3.2 Test Build Locally (Optional)
```bash
NODE_ENV=production npm start
```

Visit `http://localhost:5000` to verify.

---

## 🌐 STEP 4: DEPLOY TO SERVER

### Option A: Direct Server Deployment

#### 4.1 Transfer Files
```bash
# Using rsync (recommended)
rsync -avz --exclude 'node_modules' ./ user@your-server:/path/to/satha-choice/

# Or using scp
scp -r . user@your-server:/path/to/satha-choice/
```

#### 4.2 Setup on Server
```bash
ssh user@your-server
cd /path/to/satha-choice

# Install dependencies (production only)
npm install --production

cd client
npm install --production
npm run build
cd ..
```

#### 4.3 Start with PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "satha-choice" -- start

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

#### 4.4 Monitor Application
```bash
# View logs
pm2 logs satha-choice

# Monitor status
pm2 monit

# Restart
pm2 restart satha-choice
```

### Option B: Docker Deployment (Advanced)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

WORKDIR /app/client
RUN npm install --production && npm run build

WORKDIR /app

EXPOSE 5000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t satha-choice .
docker run -d -p 5000:5000 --env-file .env satha-choice
```

---

## 🔒 STEP 5: SSL/HTTPS SETUP (RECOMMENDED)

### Using Nginx as Reverse Proxy

#### 5.1 Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

#### 5.2 Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/satha-choice
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### 5.3 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/satha-choice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5.4 Get SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 📱 STEP 6: MOBILE APP (APK) GENERATION

### 6.1 Using Capacitor (Recommended)

#### Install Capacitor
```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
```

#### Add Android Platform
```bash
npx cap add android
```

#### Build and Sync
```bash
npm run build
npx cap sync
```

#### Open in Android Studio
```bash
npx cap open android
```

In Android Studio:
1. Build → Generate Signed Bundle/APK
2. Choose APK
3. Create keystore (first time) or use existing
4. Build release APK

APK location: `android/app/build/outputs/apk/release/app-release.apk`

### 6.2 Using Cordova (Alternative)

```bash
npm install -g cordova
cordova create satha-mobile com.satha.choice SathaChoice
cd satha-mobile
cordova platform add android
cordova build android --release
```

---

## 🔍 STEP 7: VERIFICATION

### 7.1 Health Checks
```bash
# Check if server is running
curl http://localhost:5000/api/health

# Check database connection
psql -U satha_user -d satha_choice -c "SELECT 1;"

# Check PM2 status
pm2 status
```

### 7.2 Test Features
- [ ] Customer Registration & Login
- [ ] Driver Registration & Login
- [ ] Order Creation (Cash & Wallet)
- [ ] Real-time Driver Location
- [ ] WebSocket connectivity
- [ ] Push Notifications
- [ ] Image Upload
- [ ] Wallet Top-up

---

## 🛠️ TROUBLESHOOTING

### Issue: "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check DATABASE_URL in .env
# Ensure IP/port are correct
```

### Issue: "Socket connection failed"
```bash
# Check firewall
sudo ufw status
sudo ufw allow 5000

# Check CORS settings in server/.env
# Ensure ALLOWED_ORIGINS includes your domain
```

### Issue: "Build fails"
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

cd client
rm -rf node_modules package-lock.json
npm install
cd ..
```

### Issue: "PM2 not starting"
```bash
# Check logs
pm2 logs satha-choice --lines 100

# Delete and restart
pm2 delete satha-choice
pm2 start npm --name "satha-choice" -- start
```

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks
```bash
# Check logs
pm2 logs satha-choice --lines 50

# Check disk space
df -h

# Check memory
free -m
```

### Weekly Tasks
- Backup database
- Review error logs
- Update dependencies (security patches)

### Backup Database
```bash
# Create backup
pg_dump -U satha_user satha_choice > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U satha_user satha_choice < backup_20260203.sql
```

---

## 🔄 UPDATES & ROLLBACK

### Deploy Update
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install
cd client && npm install && npm run build && cd ..

# Restart
pm2 restart satha-choice
```

### Rollback
```bash
# Revert to previous commit
git reset --hard <previous-commit-hash>

# Rebuild and restart
cd client && npm run build && cd ..
pm2 restart satha-choice
```

---

## 📞 SUPPORT

For issues during deployment:
1. Check logs: `pm2 logs satha-choice`
2. Review .env configuration
3. Verify database connectivity
4. Check firewall/port settings

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Application accessible via domain
- [ ] HTTPS working (green padlock)
- [ ] All API endpoints responding
- [ ] WebSocket connections stable
- [ ] Database queries working
- [ ] File uploads working
- [ ] Notifications sending
- [ ] Mobile app tested on device
- [ ] Backups configured
- [ ] Monitoring setup (PM2/logs)

---

**🎉 DEPLOYMENT COMPLETE! Your SATHA application is now live in production.**
