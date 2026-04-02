// routes/gift-cards.js — MIYU Nail Studio Gift Cards System
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database(process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db');

// ─── GIFT CARD CONFIGURATION ─────────────────────────────────────────────────────────
const GIFT_CARD_CONFIG = {
  denominations: [25, 50, 75, 100, 150, 200, 250, 500],
  expiryMonths: 12,
  codeLength: 12,
  codePrefix: 'MIYU'
};

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────────────
function generateGiftCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = GIFT_CARD_CONFIG.codePrefix;
  for (let i = 0; i < GIFT_CARD_CONFIG.codeLength - 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function calculateExpiryDate(months) {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split('T')[0];
}

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────────

// Create a new gift card
router.post('/create', (req, res) => {
  try {
    const { amount, purchaserName, purchaserEmail, recipientName, recipientEmail, message, deliveryMethod = 'email' } = req.body;
    
    if (!amount || !purchaserName || !purchaserEmail || !recipientName || !recipientEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!GIFT_CARD_CONFIG.denominations.includes(amount)) {
      return res.status(400).json({ error: 'Invalid amount. Available denominations: ' + GIFT_CARD_CONFIG.denominations.join(', ') });
    }
    
    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateGiftCardCode();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Unable to generate unique code' });
      }
    } while (db.prepare('SELECT id FROM gift_cards WHERE code = ?').get(code));
    
    // Create gift card
    const result = db.prepare(`
      INSERT INTO gift_cards (
        code, amount, originalAmount, status,
        purchaserName, purchaserEmail,
        recipientName, recipientEmail,
        message, deliveryMethod,
        createdAt, expiresAt
      ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      code, amount, amount,
      purchaserName, purchaserEmail,
      recipientName, recipientEmail,
      message, deliveryMethod,
      calculateExpiryDate(GIFT_CARD_CONFIG.expiryMonths)
    );
    
    // Send email (in real implementation)
    // await sendGiftCardEmail(code, amount, recipientEmail, message);
    
    res.json({
      success: true,
      giftCardId: result.lastInsertRowid,
      code,
      amount,
      expiresAt: calculateExpiryDate(GIFT_CARD_CONFIG.expiryMonths),
      message: 'Gift card created successfully'
    });
    
  } catch (error) {
    console.error('Create gift card error:', error);
    res.status(500).json({ error: 'Failed to create gift card' });
  }
});

// Get gift card details
router.get('/card/:code', (req, res) => {
  try {
    const { code } = req.params;
    
    const giftCard = db.prepare(`
      SELECT 
        id, code, amount, originalAmount, status,
        purchaserName, recipientName, message,
        createdAt, expiresAt, lastUsedAt
      FROM gift_cards 
      WHERE code = ?
    `).get(code);
    
    if (!giftCard) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    // Check if expired
    const today = new Date().toISOString().split('T')[0];
    const isExpired = giftCard.expiresAt < today;
    
    // Get usage history
    const usageHistory = db.prepare(`
      SELECT id, bookingId, amountUsed, usedAt
      FROM gift_card_usage
      WHERE giftCardId = ?
      ORDER BY usedAt DESC
    `).all(giftCard.id);
    
    res.json({
      ...giftCard,
      isExpired,
      remainingBalance: giftCard.amount,
      usageHistory
    });
    
  } catch (error) {
    console.error('Get gift card error:', error);
    res.status(500).json({ error: 'Failed to fetch gift card details' });
  }
});

// Redeem gift card
router.post('/redeem', (req, res) => {
  try {
    const { code, bookingId, amount } = req.body;
    
    if (!code || !bookingId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Start transaction
    const transaction = db.transaction(() => {
      // Get gift card
      const giftCard = db.prepare('SELECT id, amount, status, expiresAt FROM gift_cards WHERE code = ?').get(code);
      
      if (!giftCard) {
        throw new Error('Gift card not found');
      }
      
      if (giftCard.status !== 'active') {
        throw new Error('Gift card is not active');
      }
      
      // Check expiry
      const today = new Date().toISOString().split('T')[0];
      if (giftCard.expiresAt < today) {
        throw new Error('Gift card has expired');
      }
      
      // Check balance
      if (giftCard.amount < amount) {
        throw new Error('Insufficient gift card balance');
      }
      
      // Update gift card balance
      const newBalance = giftCard.amount - amount;
      db.prepare('UPDATE gift_cards SET amount = ?, lastUsedAt = datetime("now") WHERE id = ?')
        .run(newBalance, giftCard.id);
      
      // If balance is zero, deactivate card
      if (newBalance === 0) {
        db.prepare('UPDATE gift_cards SET status = "used" WHERE id = ?').run(giftCard.id);
      }
      
      // Record usage
      db.prepare(`
        INSERT INTO gift_card_usage (giftCardId, bookingId, amountUsed, usedAt)
        VALUES (?, ?, ?, datetime('now'))
      `).run(giftCard.id, bookingId, amount);
      
      return { newBalance, giftCardId: giftCard.id };
    });
    
    const result = transaction();
    
    res.json({
      success: true,
      amountRedeemed: amount,
      remainingBalance: result.newBalance,
      giftCardId: result.giftCardId
    });
    
  } catch (error) {
    console.error('Redeem gift card error:', error);
    res.status(500).json({ error: error.message || 'Failed to redeem gift card' });
  }
});

// Get customer's gift cards
router.get('/customer/:email', (req, res) => {
  try {
    const { email } = req.params;
    
    const giftCards = db.prepare(`
      SELECT 
        id, code, amount, originalAmount, status,
        purchaserName, message, createdAt, expiresAt, lastUsedAt
      FROM gift_cards 
      WHERE recipientEmail = ? OR purchaserEmail = ?
      ORDER BY createdAt DESC
    `).all(email, email);
    
    // Add expiry status
    const today = new Date().toISOString().split('T')[0];
    const giftCardsWithStatus = giftCards.map(card => ({
      ...card,
      isExpired: card.expiresAt < today,
      daysUntilExpiry: Math.ceil((new Date(card.expiresAt) - new Date(today)) / (1000 * 60 * 60 * 24))
    }));
    
    res.json(giftCardsWithStatus);
    
  } catch (error) {
    console.error('Get customer gift cards error:', error);
    res.status(500).json({ error: 'Failed to fetch customer gift cards' });
  }
});

// Get all gift cards (admin)
router.get('/all', (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    let query = `
      SELECT 
        id, code, amount, originalAmount, status,
        purchaserName, purchaserEmail,
        recipientName, recipientEmail,
        deliveryMethod, createdAt, expiresAt, lastUsedAt
      FROM gift_cards
    `;
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    const giftCards = db.prepare(query).all(...params);
    
    // Get total count
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM gift_cards').get().count;
    
    res.json({
      giftCards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Get all gift cards error:', error);
    res.status(500).json({ error: 'Failed to fetch gift cards' });
  }
});

// Get gift card statistics
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalGiftCards: db.prepare('SELECT COUNT(*) as count FROM gift_cards').get()?.count || 0,
      activeGiftCards: db.prepare('SELECT COUNT(*) as count FROM gift_cards WHERE status = "active"').get()?.count || 0,
      usedGiftCards: db.prepare('SELECT COUNT(*) as count FROM gift_cards WHERE status = "used"').get()?.count || 0,
      expiredGiftCards: db.prepare('SELECT COUNT(*) as count FROM gift_cards WHERE expiresAt < date("now")').get()?.count || 0,
      totalValue: db.prepare('SELECT SUM(originalAmount) as total FROM gift_cards').get()?.total || 0,
      totalRedeemed: db.prepare('SELECT SUM(originalAmount - amount) as total FROM gift_cards WHERE status = "used"').get()?.total || 0,
      totalRemaining: db.prepare('SELECT SUM(amount) as total FROM gift_cards WHERE status = "active"').get()?.total || 0
    };
    
    // Get sales by month
    const salesByMonth = db.prepare(`
      SELECT 
        strftime('%Y-%m', createdAt) as month,
        COUNT(*) as count,
        SUM(originalAmount) as total
      FROM gift_cards
      WHERE createdAt >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month DESC
    `).all();
    
    // Get denomination breakdown
    const denominationBreakdown = db.prepare(`
      SELECT originalAmount as denomination, COUNT(*) as count
      FROM gift_cards
      GROUP BY originalAmount
      ORDER BY denomination
    `).all();
    
    res.json({
      ...stats,
      salesByMonth,
      denominationBreakdown,
      averageGiftCardValue: stats.totalGiftCards > 0 ? stats.totalValue / stats.totalGiftCards : 0
    });
    
  } catch (error) {
    console.error('Get gift card stats error:', error);
    res.status(500).json({ error: 'Failed to fetch gift card statistics' });
  }
});

// Update gift card status (admin)
router.patch('/:giftCardId/status', (req, res) => {
  try {
    const { giftCardId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'used', 'expired', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = db.prepare(`
      UPDATE gift_cards SET status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(status, giftCardId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    res.json({ success: true, status });
    
  } catch (error) {
    console.error('Update gift card status error:', error);
    res.status(500).json({ error: 'Failed to update gift card status' });
  }
});

// Get available denominations
router.get('/denominations', (req, res) => {
  try {
    res.json({
      denominations: GIFT_CARD_CONFIG.denominations,
      currency: 'EUR',
      expiryMonths: GIFT_CARD_CONFIG.expiryMonths
    });
  } catch (error) {
    console.error('Get denominations error:', error);
    res.status(500).json({ error: 'Failed to get denominations' });
  }
});

module.exports = router;
