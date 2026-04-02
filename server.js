// server.js — MIYU Nail Studio Backend
require('dotenv').config();

// Initialize database first
console.log('🚀 Server starting - initializing database...');
require('./init-db');
console.log('✅ Database initialization completed');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security ────────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || '*'
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use('/api', apiLimiter);

app.use('/api/auth', strictLimiter, require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/nailers', require('./routes/nailers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/crm', require('./routes/crm')); // CRM routes
app.use('/api/rewards', require('./routes/rewards')); // Rewards & Loyalty
app.use('/api/reviews', require('./routes/reviews')); // Reviews & Ratings
app.use('/api/pricing', require('./routes/smart-pricing')); // Smart Pricing
app.use('/api/gift-cards', require('./routes/gift-cards')); // Gift Cards

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MIYU Nail Studio API',
    version: '1.1.0',
    features: [
      'Bookings',
      'Customers CRM',
      'Auto Tier (VIP)',
      'Analytics Dashboard',
      'Birthday Email Automation',
      'Rewards & Loyalty',
      'Reviews & Ratings',
      'Smart Pricing',
      'Gift Cards',
      '24/7 Online Booking'
    ],
    timestamp: new Date().toISOString()
  });
});

// ─── SPA Fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => {
    if (err) next(err);
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Ein Fehler ist aufgetreten.'
      : err.message
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌸 MIYU Nail Studio API running on http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`   Booking page: http://localhost:${PORT}/`);
  console.log(`   API docs: http://localhost:${PORT}/api/health\n`);
});