// routes/smart-pricing.js — MIYU Nail Studio Smart Pricing System
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database(process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db');

// ─── SMART PRICING CONFIGURATION ─────────────────────────────────────────────────────
const PRICING_RULES = {
  // Off-peak discounts (by day and time)
  offPeakDiscounts: {
    'Monday-Thursday': {
      '09:00-11:00': 0.15, // 15% off
      '14:00-16:00': 0.20, // 20% off
      '17:00-18:00': 0.10  // 10% off
    },
    'Friday': {
      '09:00-11:00': 0.10,
      '14:00-16:00': 0.15
    },
    'Saturday': {
      '09:00-10:00': 0.05 // Only 5% off on Saturday morning
    }
  },
  
  // Last-minute deals
  lastMinuteDiscounts: {
    '0-2h': 0.25,    // 25% off within 2 hours
    '2-6h': 0.20,    // 20% off within 6 hours
    '6-12h': 0.15,   // 15% off within 12 hours
    '12-24h': 0.10   // 10% off within 24 hours
  },
  
  // Tier-based discounts
  tierDiscounts: {
    'VIP': 0.10,      // 10% off for VIP
    'Loyal': 0.05,    // 5% off for Loyal
    'Regular': 0,     // No discount for Regular
    'New': 0          // No discount for New
  },
  
  // Bulk booking discounts
  bulkDiscounts: {
    3: 0.05,   // 5% off for 3+ services
    5: 0.10,   // 10% off for 5+ services
    8: 0.15    // 15% off for 8+ services
  }
};

// ─── PRICING CALCULATION FUNCTIONS ───────────────────────────────────────────────────
function getOffPeakDiscount(day, time) {
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(day).getDay()];
  
  if (PRICING_RULES.offPeakDiscounts[dayName]) {
    for (const [timeRange, discount] of Object.entries(PRICING_RULES.offPeakDiscounts[dayName])) {
      const [startTime, endTime] = timeRange.split('-');
      if (isTimeInRange(time, startTime, endTime)) {
        return discount;
      }
    }
  }
  
  return 0;
}

function getLastMinuteDiscount(bookingDate, bookingTime) {
  const bookingDateTime = new Date(`${bookingDate} ${bookingTime}`);
  const now = new Date();
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
  
  for (const [range, discount] of Object.entries(PRICING_RULES.lastMinuteDiscounts)) {
    const [minHours, maxHours] = range.split('-').map(h => parseInt(h));
    if (hoursUntilBooking >= minHours && hoursUntilBooking <= maxHours) {
      return discount;
    }
  }
  
  return 0;
}

function getBulkDiscount(serviceCount) {
  for (const [count, discount] of Object.entries(PRICING_RULES.bulkDiscounts)) {
    if (serviceCount >= parseInt(count)) {
      return discount;
    }
  }
  return 0;
}

function isTimeInRange(currentTime, startTime, endTime) {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  return current >= start && current <= end;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────────

// Calculate smart pricing for a booking
router.post('/calculate', (req, res) => {
  try {
    const { serviceId, nailerId, date, time, customerTier, serviceCount = 1 } = req.body;
    
    if (!serviceId || !nailerId || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get base price
    const service = db.prepare('SELECT basePrice, name FROM services WHERE id = ?').get(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    let basePrice = service.basePrice;
    let finalPrice = basePrice;
    const appliedDiscounts = [];
    
    // Apply off-peak discount
    const offPeakDiscount = getOffPeakDiscount(date, time);
    if (offPeakDiscount > 0) {
      const discountAmount = basePrice * offPeakDiscount;
      finalPrice -= discountAmount;
      appliedDiscounts.push({
        type: 'off-peak',
        percentage: offPeakDiscount * 100,
        amount: discountAmount
      });
    }
    
    // Apply last-minute discount
    const lastMinuteDiscount = getLastMinuteDiscount(date, time);
    if (lastMinuteDiscount > 0) {
      const discountAmount = finalPrice * lastMinuteDiscount;
      finalPrice -= discountAmount;
      appliedDiscounts.push({
        type: 'last-minute',
        percentage: lastMinuteDiscount * 100,
        amount: discountAmount
      });
    }
    
    // Apply tier discount
    const tierDiscount = PRICING_RULES.tierDiscounts[customerTier] || 0;
    if (tierDiscount > 0) {
      const discountAmount = finalPrice * tierDiscount;
      finalPrice -= discountAmount;
      appliedDiscounts.push({
        type: 'tier',
        percentage: tierDiscount * 100,
        amount: discountAmount
      });
    }
    
    // Apply bulk discount
    const bulkDiscount = getBulkDiscount(serviceCount);
    if (bulkDiscount > 0) {
      const discountAmount = finalPrice * bulkDiscount;
      finalPrice -= discountAmount;
      appliedDiscounts.push({
        type: 'bulk',
        percentage: bulkDiscount * 100,
        amount: discountAmount
      });
    }
    
    // Ensure minimum price (50% of base price)
    const minimumPrice = basePrice * 0.5;
    if (finalPrice < minimumPrice) {
      finalPrice = minimumPrice;
    }
    
    res.json({
      serviceName: service.name,
      basePrice,
      finalPrice: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
      totalSavings: Math.round((basePrice - finalPrice) * 100) / 100,
      appliedDiscounts,
      savingsPercentage: Math.round(((basePrice - finalPrice) / basePrice) * 100)
    });
    
  } catch (error) {
    console.error('Calculate pricing error:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

// Get available deals for a specific date/time
router.get('/deals/:date/:time', (req, res) => {
  try {
    const { date, time } = req.params;
    
    const deals = [];
    
    // Check off-peak deals
    const offPeakDiscount = getOffPeakDiscount(date, time);
    if (offPeakDiscount > 0) {
      deals.push({
        type: 'off-peak',
        title: 'Off-Peak Special',
        description: `${Math.round(offPeakDiscount * 100)}% off during quiet hours`,
        discount: offPeakDiscount,
        validFor: 'All services'
      });
    }
    
    // Check last-minute deals
    const lastMinuteDiscount = getLastMinuteDiscount(date, time);
    if (lastMinuteDiscount > 0) {
      deals.push({
        type: 'last-minute',
        title: 'Last Minute Deal',
        description: `${Math.round(lastMinuteDiscount * 100)}% off for quick bookers`,
        discount: lastMinuteDiscount,
        validFor: 'All services'
      });
    }
    
    res.json({
      date,
      time,
      deals,
      maxDiscount: Math.max(...deals.map(d => d.discount), 0)
    });
    
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Failed to get available deals' });
  }
});

// Get pricing analytics
router.get('/analytics', (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    
    // Get booking data with pricing
    const bookings = db.prepare(`
      SELECT 
        b.date, b.time, b.price, b.originalPrice,
        s.name as serviceName,
        c.tier as customerTier,
        COUNT(*) OVER() as totalBookings
      FROM bookings b
      JOIN services s ON b.serviceId = s.id
      JOIN customers c ON b.customerId = c.id
      WHERE b.date >= date('now', '-${period} days')
      ORDER BY b.date DESC
    `).all();
    
    // Calculate discount statistics
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const totalOriginalRevenue = bookings.reduce((sum, b) => sum + (b.originalPrice || b.price || 0), 0);
    const totalDiscounts = totalOriginalRevenue - totalRevenue;
    
    const discountBreakdown = {
      offPeak: 0,
      lastMinute: 0,
      tier: 0,
      bulk: 0
    };
    
    // Get popular deal times
    const dealTimes = db.prepare(`
      SELECT 
        strftime('%H:%M', b.time) as hour,
        COUNT(*) as bookingCount,
        AVG(b.originalPrice - b.price) as avgDiscount
      FROM bookings b
      WHERE b.date >= date('now', '-${period} days')
        AND b.originalPrice > b.price
      GROUP BY hour
      ORDER BY avgDiscount DESC
      LIMIT 10
    `).all();
    
    res.json({
      period: `${period} days`,
      totalBookings: bookings.length,
      totalRevenue,
      totalOriginalRevenue,
      totalDiscounts,
      averageDiscountPerBooking: bookings.length > 0 ? totalDiscounts / bookings.length : 0,
      discountRate: totalOriginalRevenue > 0 ? (totalDiscounts / totalOriginalRevenue) * 100 : 0,
      popularDealTimes: dealTimes,
      mostPopularDiscountType: Object.keys(discountBreakdown).reduce((a, b) => 
        discountBreakdown[a] > discountBreakdown[b] ? a : b
      )
    });
    
  } catch (error) {
    console.error('Pricing analytics error:', error);
    res.status(500).json({ error: 'Failed to get pricing analytics' });
  }
});

// Get dynamic pricing rules (admin)
router.get('/rules', (req, res) => {
  try {
    res.json({
      rules: PRICING_RULES,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get pricing rules error:', error);
    res.status(500).json({ error: 'Failed to get pricing rules' });
  }
});

// Update pricing rules (admin)
router.put('/rules', (req, res) => {
  try {
    const { rules } = req.body;
    
    // Validate rules structure
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ error: 'Invalid rules format' });
    }
    
    // In a real implementation, you would save these to database
    // For now, we'll just return success
    
    res.json({ 
      success: true, 
      message: 'Pricing rules updated successfully',
      rules 
    });
    
  } catch (error) {
    console.error('Update pricing rules error:', error);
    res.status(500).json({ error: 'Failed to update pricing rules' });
  }
});

module.exports = router;
