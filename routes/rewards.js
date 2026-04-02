// routes/rewards.js — MIYU Nail Studio Rewards & Loyalty System
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database(process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db');

// ─── REWARDS CONFIGURATION ───────────────────────────────────────────────────────────
const REWARDS_CONFIG = {
  pointsPerEuro: 10, // 10 points per €1 spent
  tierBonusPoints: {
    'VIP': 50,      // 50 bonus points per booking
    'Loyal': 25,    // 25 bonus points per booking
    'Regular': 10,  // 10 bonus points per booking
    'New': 5        // 5 bonus points per booking
  },
  redemptionRates: {
    100: 5,   // 100 points = €5 discount
    200: 12,  // 200 points = €12 discount
    500: 35,  // 500 points = €35 discount
    1000: 80  // 1000 points = €80 discount
  }
};

// ─── POINTS CALCULATION ─────────────────────────────────────────────────────────────
function calculatePoints(booking) {
  const basePoints = Math.round(booking.price * REWARDS_CONFIG.pointsPerEuro);
  const tierBonus = REWARDS_CONFIG.tierBonusPoints[booking.customerTier] || 0;
  const serviceBonus = booking.serviceCategory === 'premium' ? 20 : 0;
  
  return basePoints + tierBonus + serviceBonus;
}

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────────

// Get customer rewards balance and history
router.get('/customer/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get customer info
    const customer = db.prepare(`
      SELECT id, firstName, lastName, tier, email, phone
      FROM customers WHERE id = ?
    `).get(customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get rewards balance
    const rewards = db.prepare(`
      SELECT totalPoints, redeemedPoints, availablePoints, lastUpdated
      FROM customer_rewards WHERE customerId = ?
    `).get(customerId);
    
    // Get points history
    const history = db.prepare(`
      SELECT id, type, points, description, referenceId, createdAt
      FROM rewards_history 
      WHERE customerId = ? 
      ORDER BY createdAt DESC 
      LIMIT 20
    `).all(customerId);
    
    // Get available rewards
    const availableRewards = Object.entries(REWARDS_CONFIG.redemptionRates).map(([points, discount]) => ({
      pointsRequired: parseInt(points),
      discountAmount: discount,
      canRedeem: (rewards?.availablePoints || 0) >= parseInt(points)
    }));
    
    res.json({
      customer,
      rewards: rewards || { totalPoints: 0, redeemedPoints: 0, availablePoints: 0 },
      history,
      availableRewards
    });
    
  } catch (error) {
    console.error('Rewards error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards data' });
  }
});

// Add points from booking
router.post('/add-points', (req, res) => {
  try {
    const { customerId, bookingId, points, description } = req.body;
    
    if (!customerId || !bookingId || !points || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Start transaction
    const transaction = db.transaction(() => {
      // Update or insert rewards balance
      const existing = db.prepare(`
        SELECT availablePoints FROM customer_rewards WHERE customerId = ?
      `).get(customerId);
      
      if (existing) {
        db.prepare(`
          UPDATE customer_rewards 
          SET totalPoints = totalPoints + ?, 
              availablePoints = availablePoints + ?,
              lastUpdated = datetime('now')
          WHERE customerId = ?
        `).run(points, points, customerId);
      } else {
        db.prepare(`
          INSERT INTO customer_rewards (customerId, totalPoints, availablePoints, lastUpdated)
          VALUES (?, ?, ?, datetime('now'))
        `).run(customerId, points, points);
      }
      
      // Add to history
      db.prepare(`
        INSERT INTO rewards_history (customerId, type, points, description, referenceId)
        VALUES (?, 'earned', ?, ?, ?)
      `).run(customerId, points, description, bookingId);
    });
    
    transaction();
    
    res.json({ success: true, pointsAdded: points });
    
  } catch (error) {
    console.error('Add points error:', error);
    res.status(500).json({ error: 'Failed to add points' });
  }
});

// Redeem points for discount
router.post('/redeem', (req, res) => {
  try {
    const { customerId, pointsRedeemed, discountAmount } = req.body;
    
    if (!customerId || !pointsRedeemed || !discountAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate redemption rate
    const expectedDiscount = REWARDS_CONFIG.redemptionRates[pointsRedeemed];
    if (!expectedDiscount || expectedDiscount !== discountAmount) {
      return res.status(400).json({ error: 'Invalid redemption amount' });
    }
    
    // Start transaction
    const transaction = db.transaction(() => {
      // Check available points
      const rewards = db.prepare(`
        SELECT availablePoints FROM customer_rewards WHERE customerId = ?
      `).get(customerId);
      
      if (!rewards || rewards.availablePoints < pointsRedeemed) {
        throw new Error('Insufficient points');
      }
      
      // Update rewards balance
      db.prepare(`
        UPDATE customer_rewards 
        SET redeemedPoints = redeemedPoints + ?,
            availablePoints = availablePoints - ?,
            lastUpdated = datetime('now')
        WHERE customerId = ?
      `).run(pointsRedeemed, pointsRedeemed, customerId);
      
      // Add to history
      db.prepare(`
        INSERT INTO rewards_history (customerId, type, points, description)
        VALUES (?, 'redeemed', ?, ?)
      `).run(customerId, -pointsRedeemed, `Redeemed ${pointsRedeemed} points for €${discountAmount} discount`);
      
      // Generate discount code
      const discountCode = `MIYU${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      db.prepare(`
        INSERT INTO discount_codes (code, customerId, discountAmount, pointsUsed, status, expiresAt)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '+30 days'))
      `).run(discountCode, customerId, discountAmount, pointsRedeemed);
      
      return discountCode;
    });
    
    const discountCode = transaction();
    
    res.json({ 
      success: true, 
      discountCode,
      discountAmount,
      pointsRedeemed
    });
    
  } catch (error) {
    console.error('Redeem points error:', error);
    res.status(500).json({ error: error.message || 'Failed to redeem points' });
  }
});

// Get rewards leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    const leaderboard = db.prepare(`
      SELECT 
        c.id,
        c.firstName,
        c.lastName,
        c.tier,
        COALESCE(r.totalPoints, 0) as totalPoints,
        COALESCE(r.availablePoints, 0) as availablePoints,
        COUNT(b.id) as totalBookings
      FROM customers c
      LEFT JOIN customer_rewards r ON c.id = r.customerId
      LEFT JOIN bookings b ON c.id = b.customerId
      GROUP BY c.id
      ORDER BY totalPoints DESC
      LIMIT 20
    `).all();
    
    res.json(leaderboard);
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get rewards statistics
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalPointsIssued: db.prepare('SELECT SUM(points) as total FROM rewards_history WHERE type = "earned"').get()?.total || 0,
      totalPointsRedeemed: db.prepare('SELECT SUM(ABS(points)) as total FROM rewards_history WHERE type = "redeemed"').get()?.total || 0,
      activeMembers: db.prepare('SELECT COUNT(*) as count FROM customer_rewards WHERE availablePoints > 0').get()?.count || 0,
      totalRedemptions: db.prepare('SELECT COUNT(*) as count FROM discount_codes WHERE status = "used"').get()?.count || 0
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Rewards stats error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards stats' });
  }
});

module.exports = router;
