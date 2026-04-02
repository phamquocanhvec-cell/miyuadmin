// routes/reviews.js — MIYU Nail Studio Reviews & Ratings System
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database(process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db');

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────────

// Submit a review
router.post('/submit', (req, res) => {
  try {
    const { customerId, bookingId, rating, comment, serviceRating, atmosphereRating, staffRating } = req.body;
    
    if (!customerId || !bookingId || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Check if review already exists for this booking
    const existing = db.prepare(`
      SELECT id FROM reviews WHERE bookingId = ?
    `).get(bookingId);
    
    if (existing) {
      return res.status(400).json({ error: 'Review already exists for this booking' });
    }
    
    // Insert review
    const result = db.prepare(`
      INSERT INTO reviews (
        customerId, bookingId, rating, comment, 
        serviceRating, atmosphereRating, staffRating,
        status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', datetime('now'))
    `).run(customerId, bookingId, rating, comment, serviceRating, atmosphereRating, staffRating);
    
    // Update service and nailer ratings
    updateServiceRatings(bookingId);
    updateNailerRatings(bookingId);
    
    res.json({ 
      success: true, 
      reviewId: result.lastInsertRowid,
      message: 'Review submitted successfully'
    });
    
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a service
router.get('/service/:serviceId', (req, res) => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    
    let query = `
      SELECT 
        r.id, r.rating, r.comment, r.serviceRating, r.atmosphereRating, r.staffRating,
        r.createdAt, r.status,
        c.firstName, c.lastName, c.tier,
        b.date as bookingDate
      FROM reviews r
      JOIN customers c ON r.customerId = c.id
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = ? AND r.status = 'approved'
    `;
    const params = [serviceId];
    
    if (rating) {
      query += ' AND r.rating = ?';
      params.push(rating);
    }
    
    query += ' ORDER BY r.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    const reviews = db.prepare(query).all(...params);
    
    // Get rating distribution
    const ratingDistribution = db.prepare(`
      SELECT rating, COUNT(*) as count
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = ? AND r.status = 'approved'
      GROUP BY rating
      ORDER BY rating
    `).all(serviceId);
    
    // Calculate average rating
    const avgRating = db.prepare(`
      SELECT AVG(rating) as average
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = ? AND r.status = 'approved'
    `).get(serviceId)?.average || 0;
    
    res.json({
      reviews,
      ratingDistribution,
      averageRating: parseFloat(avgRating).toFixed(1),
      totalReviews: reviews.length
    });
    
  } catch (error) {
    console.error('Get service reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews for a nailer
router.get('/nailer/:nailerId', (req, res) => {
  try {
    const { nailerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = db.prepare(`
      SELECT 
        r.id, r.rating, r.comment, r.serviceRating, r.atmosphereRating, r.staffRating,
        r.createdAt, r.status,
        c.firstName, c.lastName, c.tier,
        s.name as serviceName,
        b.date as bookingDate
      FROM reviews r
      JOIN customers c ON r.customerId = c.id
      JOIN bookings b ON r.bookingId = b.id
      JOIN services s ON b.serviceId = s.id
      WHERE b.nailerId = ? AND r.status = 'approved'
      ORDER BY r.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(nailerId, limit, (page - 1) * limit);
    
    // Get nailer rating stats
    const stats = db.prepare(`
      SELECT 
        AVG(rating) as averageRating,
        AVG(serviceRating) as avgServiceRating,
        AVG(atmosphereRating) as avgAtmosphereRating,
        AVG(staffRating) as avgStaffRating,
        COUNT(*) as totalReviews
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.nailerId = ? AND r.status = 'approved'
    `).get(nailerId);
    
    res.json({
      reviews,
      stats: {
        averageRating: parseFloat(stats.averageRating || 0).toFixed(1),
        avgServiceRating: parseFloat(stats.avgServiceRating || 0).toFixed(1),
        avgAtmosphereRating: parseFloat(stats.avgAtmosphereRating || 0).toFixed(1),
        avgStaffRating: parseFloat(stats.avgStaffRating || 0).toFixed(1),
        totalReviews: stats.totalReviews || 0
      }
    });
    
  } catch (error) {
    console.error('Get nailer reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get customer's reviews
router.get('/customer/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    
    const reviews = db.prepare(`
      SELECT 
        r.id, r.rating, r.comment, r.serviceRating, r.atmosphereRating, r.staffRating,
        r.createdAt, r.status,
        s.name as serviceName,
        n.firstName as nailerFirstName,
        n.lastName as nailerLastName,
        b.date as bookingDate
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      JOIN services s ON b.serviceId = s.id
      JOIN nailers n ON b.nailerId = n.id
      WHERE r.customerId = ?
      ORDER BY r.createdAt DESC
    `).all(customerId);
    
    res.json(reviews);
    
  } catch (error) {
    console.error('Get customer reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch customer reviews' });
  }
});

// Get all reviews (for admin)
router.get('/all', (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'approved', rating } = req.query;
    
    let query = `
      SELECT 
        r.id, r.rating, r.comment, r.serviceRating, r.atmosphereRating, r.staffRating,
        r.createdAt, r.status,
        c.firstName as customerFirstName, c.lastName as customerLastName, c.tier,
        s.name as serviceName,
        n.firstName as nailerFirstName, n.lastName as nailerLastName,
        b.date as bookingDate
      FROM reviews r
      JOIN customers c ON r.customerId = c.id
      JOIN bookings b ON r.bookingId = b.id
      JOIN services s ON b.serviceId = s.id
      JOIN nailers n ON b.nailerId = n.id
      WHERE r.status = ?
    `;
    const params = [status];
    
    if (rating) {
      query += ' AND r.rating = ?';
      params.push(rating);
    }
    
    query += ' ORDER BY r.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    const reviews = db.prepare(query).all(...params);
    
    // Get total count
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM reviews WHERE status = ?
    `).get(status).count;
    
    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Update review status (admin only)
router.patch('/:reviewId/status', (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = db.prepare(`
      UPDATE reviews SET status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(status, reviewId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ success: true, status });
    
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

// Get review statistics
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalReviews: db.prepare('SELECT COUNT(*) as count FROM reviews WHERE status = "approved"').get()?.count || 0,
      averageRating: db.prepare('SELECT AVG(rating) as avg FROM reviews WHERE status = "approved"').get()?.avg || 0,
      pendingReviews: db.prepare('SELECT COUNT(*) as count FROM reviews WHERE status = "pending"').get()?.count || 0,
      ratingDistribution: db.prepare(`
        SELECT rating, COUNT(*) as count
        FROM reviews 
        WHERE status = 'approved'
        GROUP BY rating
        ORDER BY rating
      `).all()
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────────
function updateServiceRatings(bookingId) {
  const booking = db.prepare('SELECT serviceId FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) return;
  
  const stats = db.prepare(`
    SELECT 
      AVG(rating) as avgRating,
      AVG(serviceRating) as avgServiceRating,
      COUNT(*) as totalReviews
    FROM reviews r
    JOIN bookings b ON r.bookingId = b.id
    WHERE b.serviceId = ? AND r.status = 'approved'
  `).get(booking.serviceId);
  
  db.prepare(`
    UPDATE services 
    SET averageRating = ?, averageServiceRating = ?, totalReviews = ?
    WHERE id = ?
  `).run(
    stats.avgRating || 0,
    stats.avgServiceRating || 0,
    stats.totalReviews || 0,
    booking.serviceId
  );
}

function updateNailerRatings(bookingId) {
  const booking = db.prepare('SELECT nailerId FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) return;
  
  const stats = db.prepare(`
    SELECT 
      AVG(rating) as avgRating,
      AVG(staffRating) as avgStaffRating,
      COUNT(*) as totalReviews
    FROM reviews r
    JOIN bookings b ON r.bookingId = b.id
    WHERE b.nailerId = ? AND r.status = 'approved'
  `).get(booking.nailerId);
  
  db.prepare(`
    UPDATE nailers 
    SET averageRating = ?, averageStaffRating = ?, totalReviews = ?
    WHERE id = ?
  `).run(
    stats.avgRating || 0,
    stats.avgStaffRating || 0,
    stats.totalReviews || 0,
    booking.nailerId
  );
}

module.exports = router;
