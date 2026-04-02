# 🌸 MIYU Nail Studio — Advanced CRM & Booking System

Professional salon management system inspired by Treatwell, featuring customer loyalty, smart pricing, reviews, and 24/7 online booking.

## 🎯 Key Features
- **Customer Tier Classification:** VIP/Loyal/Regular/New (automatic)
- **Rewards & Loyalty Program:** Points system with tier bonuses
- **Smart Dynamic Pricing:** Off-peak, last-minute, and bulk discounts
- **Reviews & Ratings System:** 5-star ratings with detailed feedback
- **Gift Cards & Vouchers:** Digital gift cards with expiry management
- **24/7 Online Booking Portal:** Customer-facing booking interface
- **Birthday Email Automation:** 20% discount codes sent at 9 AM daily
- **Revenue Tracking:** Projected vs Actual revenue analysis
- **German Language:** Complete interface in German
- **Dashboard Analytics:** KPI metrics and customer insights
- **Gmail Integration:** Professional email templates
- **SQLite Database:** Zero-config persistent storage

## Stack
- **Backend:** Node.js + Express
- **Database:** SQLite (zero-config, single file)
- **Auth:** JWT + bcrypt
- **Frontend:** Vanilla HTML/CSS/JS

## Project Structure
```
miyu-project/
├── server.js           # Express server
├── db.js               # SQLite schema + seed data
├── package.json
├── .env.example        # → copy to .env
├── routes/
│   ├── auth.js
│   ├── bookings.js
│   ├── nailers.js
│   ├── services.js
│   ├── slots.js
│   └── customers.js
├── middleware/
│   └── auth.js         # JWT middleware
└── public/
    ├── index.html      # Customer booking page
    └── admin.html      # Admin dashboard + calendar
```

---

## 🚀 Quick Start (Local)

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env — change JWT_SECRET and admin password!

# 3. Run
npm start
# → http://localhost:3000        (booking page)
# → http://localhost:3000/admin.html  (admin)
```

Default login: `admin` / `miyu2024secure` — **change immediately in .env**

---

## ☁️ Deploy Options

### Option A — Railway.app (Easiest, free tier)
1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variables (from .env.example)
4. Done — Railway auto-detects Node.js

### Option B — Render.com (Free tier)
1. New Web Service → connect GitHub repo
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add environment variables
5. Deploy

### Option C — VPS (Ubuntu)
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Upload project, then:
cd /var/www/miyu
npm install --production

# PM2 for process management
npm install -g pm2
pm2 start server.js --name miyu
pm2 save && pm2 startup

# Nginx reverse proxy
sudo nano /etc/nginx/sites-available/miyu
```

Nginx config:
```nginx
server {
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/miyu /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com  # HTTPS
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret for JWT tokens — **must change!** | dev secret |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password — **must change!** | `miyu2024secure` |
| `DB_PATH` | SQLite file path | `./miyu.db` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGIN` | CORS origin for production | `*` |

---

## Admin Calendar Features
- **Day view** — timeline per nail artist, click empty slot to book
- **Week view** — 7-day overview with booking blocks
- **Month view** — mini calendar, click day to drill in
- **New booking** — 4-step wizard: service → time → customer → confirm
- Bookings from customer page appear instantly on calendar

## Database Backup
```bash
cp miyu.db miyu-backup-$(date +%Y%m%d).db
```

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/services` | Active services |
| GET | `/api/nailers` | Active nail artists |
| GET | `/api/slots?nailer_id=&date=` | Available slots |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/ref/:ref` | Lookup by reference |

### Admin (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/bookings` | All bookings |
| GET | `/api/bookings/stats` | Dashboard stats |
| PATCH | `/api/bookings/:id/status` | Update status |
| CRUD | `/api/nailers` `/api/services` `/api/customers` | Manage data |
