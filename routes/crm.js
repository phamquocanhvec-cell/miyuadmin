// routes/crm.js — MIYU Nail Studio CRM Routes
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const moment = require('moment');
const Database = require('better-sqlite3');
// Use persistent storage on Render
const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db';
const db = new Database(dbPath);

// ─── EMAIL CONFIGURATION ───────────────────────────────────────────────────────────
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ─── CUSTOMER TIER CALCULATION ───────────────────────────────────────────────────────
function calculateCustomerTier(customer) {
  const visitCount = customer.visitCount || 0;
  const totalSpent = customer.totalSpent || 0;
  const daysSinceLastVisit = customer.lastVisit ? 
    moment().diff(moment(customer.lastVisit), 'days') : 999;
  
  // VIP: 10+ visits OR €500+ spent AND visited within 30 days
  if ((visitCount >= 10 || totalSpent >= 500) && daysSinceLastVisit <= 30) {
    return 'VIP';
  }
  
  // Loyal: 5-9 visits OR €200-499 spent AND visited within 60 days
  if ((visitCount >= 5 || totalSpent >= 200) && daysSinceLastVisit <= 60) {
    return 'Loyal';
  }
  
  // Regular: 1-4 visits OR spent some money AND visited within 90 days
  if ((visitCount >= 1 || totalSpent > 0) && daysSinceLastVisit <= 90) {
    return 'Regular';
  }
  
  // New: Less than 1 visit OR no spending OR visited more than 90 days ago
  return 'New';
}

// ─── UPDATE ALL CUSTOMER TIERS ───────────────────────────────────────────────────────
function updateCustomerTiers() {
  try {
    const customers = db.prepare('SELECT * FROM customers').all();
    
    customers.forEach(customer => {
      const newTier = calculateCustomerTier(customer);
      
      // Update tier if changed
      if (customer.tier !== newTier) {
        db.prepare('UPDATE customers SET tier = ? WHERE id = ?')
          .run(newTier, customer.id);
        
        console.log(`Updated customer ${customer.id} tier: ${customer.tier} → ${newTier}`);
      }
    });
    
    console.log('Customer tiers updated successfully');
  } catch (error) {
    console.error('Error updating customer tiers:', error);
  }
}

// ─── BIRTHDAY EMAIL CRON JOB ───────────────────────────────────────────────────────
cron.schedule('0 9 * * *', () => {
  // Run every day at 9 AM
  sendBirthdayEmails();
});

async function sendBirthdayEmails() {
  try {
    const today = moment().format('MM-DD');
    const customers = db.prepare(`
      SELECT * FROM customers 
      WHERE strftime('%m-%d', birthday) = ?
      AND email IS NOT NULL 
      AND email != ''
    `).all(today);
    
    for (const customer of customers) {
      await sendBirthdayEmail(customer);
    }
    
    console.log(`Sent ${customers.length} birthday emails`);
  } catch (error) {
    console.error('Error sending birthday emails:', error);
  }
}

async function sendBirthdayEmail(customer) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: customer.email,
    subject: '🌸 Herzlichen Glückwunsch von MIYU Nail Studio!',
    html: `
      <div style="font-family: 'Cormorant Garamond', serif; color: #1a1612; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c9a96e; font-size: 32px; font-weight: 300; letter-spacing: 0.15em; margin: 0;">
            MIYU <span style="color: #c4a09a; font-style: italic;">Nail Studio</span>
          </h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #f5f0e8 0%, #f9f0e6 100%); padding: 40px; border-radius: 8px; text-align: center;">
          <h2 style="color: #c4a09a; font-size: 24px; margin-bottom: 20px;">
            🎂 Herzlichen Glückwunsch, ${customer.firstName}! 🎂
          </h2>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px; color: #8a7d74;">
            Zu Ihrem besonderen Tag möchten wir Ihnen mit einem kleinen Geschenk freuen! 
            Als geschätzter Kunde erhalten Sie <strong style="color: #c9a96e;">20% Rabatt</strong> 
            auf Ihre nächste Behandlung bei uns.
          </p>
          
          <div style="background: #c9a96e; color: #1a1612; padding: 20px; border-radius: 6px; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: 500;">
              Ihr Gutscheincode: <strong>BIRTHDAY${customer.id}</strong>
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6a5d54; margin-bottom: 30px;">
            Gültig für 30 Tage ab heute
          </p>
          
          <a href="https://miyu-nail-studio.de/booking" 
             style="display: inline-block; background: linear-gradient(135deg, #c9a96e 0%, #c4a09a 100%); 
                    color: #1a1612; padding: 15px 30px; text-decoration: none; 
                    border-radius: 25px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;">
            Jetzt Termin Vereinbaren
          </a>
        </div>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(201, 169, 110, 0.2);">
          <p style="font-size: 12px; color: #8a7d74; margin: 0;">
            MIYU Nail Studio • Königsallee 1 • 40212 Düsseldorf<br>
            Telefon: 0211 1234567 • Email: info@miyu-nail-studio.de
          </p>
        </div>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────────

// Get all customers with tier information
router.get('/customers', (req, res) => {
  try {
    // Update tiers first
    updateCustomerTiers();
    
    const customers = db.prepare(`
      SELECT 
        id, firstName, lastName, email, phone, birthday,
        visitCount, totalSpent, lastVisit, nextAppointment,
        tier, createdAt, updatedAt
      FROM customers 
      ORDER BY 
        CASE tier 
          WHEN 'VIP' THEN 1
          WHEN 'Loyal' THEN 2
          WHEN 'Regular' THEN 3
          WHEN 'New' THEN 4
        END,
        totalSpent DESC
    `).all();
    
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kunden' });
  }
});

// Get customer analytics
router.get('/customers/analytics', (req, res) => {
  try {
    const analytics = db.prepare(`
      SELECT 
        COUNT(*) as totalCustomers,
        SUM(CASE WHEN tier = 'VIP' THEN 1 ELSE 0 END) as vipCount,
        SUM(CASE WHEN tier = 'Loyal' THEN 1 ELSE 0 END) as loyalCount,
        SUM(CASE WHEN tier = 'Regular' THEN 1 ELSE 0 END) as regularCount,
        SUM(CASE WHEN tier = 'New' THEN 1 ELSE 0 END) as newCount,
        AVG(totalSpent) as avgSpent,
        MAX(totalSpent) as maxSpent,
        AVG(visitCount) as avgVisits
      FROM customers
    `).get();
    
    // Monthly new customers
    const monthlyGrowth = db.prepare(`
      SELECT 
        strftime('%Y-%m', createdAt) as month,
        COUNT(*) as newCustomers
      FROM customers 
      WHERE createdAt >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month
    `).all();
    
    // Top customers by spending
    const topCustomers = db.prepare(`
      SELECT firstName, lastName, tier, totalSpent, visitCount
      FROM customers 
      ORDER BY totalSpent DESC 
      LIMIT 10
    `).all();
    
    res.json({
      summary: analytics,
      monthlyGrowth,
      topCustomers
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Analytics' });
  }
});

// Update customer tier manually
router.put('/customers/:id/tier', (req, res) => {
  try {
    const { tier } = req.body;
    const customerId = req.params.id;
    
    if (!['VIP', 'Loyal', 'Regular', 'New'].includes(tier)) {
      return res.status(400).json({ error: 'Ungültige Kundenklasse' });
    }
    
    const result = db.prepare('UPDATE customers SET tier = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
      .run(tier, customerId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Kunde nicht gefunden' });
    }
    
    res.json({ message: 'Kundenklasse aktualisiert', tier });
  } catch (error) {
    console.error('Error updating tier:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kundenklasse' });
  }
});

// Get revenue summary (projected vs actual)
router.get('/revenue/summary', (req, res) => {
  try {
    // Actual revenue from completed bookings
    const actualRevenue = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as total
      FROM bookings 
      WHERE status = 'completed' 
      AND date <= date('now')
    `).get().total;
    
    // Projected revenue from upcoming bookings
    const projectedRevenue = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as total
      FROM bookings 
      WHERE status = 'confirmed' 
      AND date >= date('now')
    `).get().total;
    
    // Monthly revenue trend
    const monthlyRevenue = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as actual,
        SUM(CASE WHEN status = 'confirmed' THEN price ELSE 0 END) as projected
      FROM bookings 
      WHERE date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month
    `).all();
    
    res.json({
      actual: actualRevenue,
      projected: projectedRevenue,
      monthly: monthlyRevenue
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Umsatzdaten' });
  }
});

// Get upcoming birthdays
router.get('/birthdays/upcoming', (req, res) => {
  try {
    const upcomingBirthdays = db.prepare(`
      SELECT 
        id, firstName, lastName, email, phone, birthday,
        tier, visitCount
      FROM customers 
      WHERE birthday IS NOT NULL
      AND (
        -- Next 7 days
        julianday(birthday) - julianday('now') BETWEEN 
          julianday(date('now', 'year 0')) - julianday(date('now')) AND
          julianday(date('now', 'year 0', '+7 days')) - julianday(date('now'))
        OR
        -- Handle year wrap-around
        julianday(birthday) - julianday('now') >= 
          julianday(date('now', 'year 0')) - julianday(date('now')) - 365
      )
      ORDER BY 
        CASE 
          WHEN julianday(birthday) - julianday('now') >= 0 
          THEN julianday(birthday) - julianday('now')
          ELSE julianday(birthday) - julianday('now') + 365
        END
      LIMIT 10
    `).all();
    
    res.json(upcomingBirthdays);
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Geburtstage' });
  }
});

// Send birthday email manually
router.post('/birthdays/send/:customerId', async (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Kunde nicht gefunden' });
    }
    
    await sendBirthdayEmail(customer);
    
    // Log the email sent
    db.prepare(`
      INSERT INTO email_logs (customerId, type, sentAt, status)
      VALUES (?, 'birthday', CURRENT_TIMESTAMP, 'sent')
    `).run(customer.id);
    
    res.json({ message: 'Geburtstags-E-Mail gesendet' });
  } catch (error) {
    console.error('Error sending birthday email:', error);
    res.status(500).json({ error: 'Fehler beim Senden der E-Mail' });
  }
});

// Get email campaign statistics
router.get('/email/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        type,
        COUNT(*) as sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked,
        DATE(sentAt) as date
      FROM email_logs 
      WHERE sentAt >= date('now', '-30 days')
      GROUP BY type, DATE(sentAt)
      ORDER BY date DESC
    `).all();
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: 'Fehler beim Laden der E-Mail Statistiken' });
  }
});

module.exports = router;
