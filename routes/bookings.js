const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `MIYU-${ts.slice(-4)}${rnd}`;
}

function upsertCustomer(firstName, lastName, phone, email) {
  const existing = db.prepare(`
    SELECT id, total_bookings, total_spent 
    FROM customers WHERE phone = ?
  `).get(phone);

  if (existing) {
    db.prepare(`
      UPDATE customers 
      SET first_name=?, last_name=?, email=?,
          total_bookings = total_bookings + 1
      WHERE id=?
    `).run(firstName, lastName, email || '', existing.id);

    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO customers (first_name, last_name, phone, email, total_bookings)
    VALUES (?, ?, ?, ?, 1)
  `).run(firstName, lastName || '', phone, email || '');

  return result.lastInsertRowid;
}

// ─────────────────────────────────────────
// POST /api/bookings
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    nailer_id, service_id, date, time,
    customer_first, customer_last, customer_phone, customer_email, note
  } = req.body;

  if (!nailer_id || !service_id || !date || !time || !customer_first || !customer_phone) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }

  const slot = db.prepare(`
    SELECT * FROM slots 
    WHERE nailer_id = ? AND date = ? AND time = ?
  `).get(nailer_id, date, time);

  if (!slot) {
    return res.status(409).json({ error: 'Dieser Slot existiert nicht.' });
  }

  if (slot.is_booked) {
    return res.status(409).json({ error: 'Dieser Termin ist bereits vergeben.' });
  }

  const bookingRef = generateRef();

  const createBooking = db.transaction(() => {
    db.prepare(`UPDATE slots SET is_booked = 1 WHERE id = ?`).run(slot.id);

    upsertCustomer(
      customer_first,
      customer_last || '',
      customer_phone,
      customer_email || ''
    );

    db.prepare(`
      INSERT INTO bookings
        (booking_ref, nailer_id, service_id, slot_id, date, time,
         customer_first, customer_last, customer_phone, customer_email, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `).run(
      bookingRef,
      nailer_id,
      service_id,
      slot.id,
      date,
      time,
      customer_first,
      customer_last || '',
      customer_phone,
      customer_email || '',
      note || ''
    );
  });

  createBooking();

  const booking = db.prepare(`
    SELECT b.*, n.name as nailer_name, n.emoji as nailer_emoji,
           s.name as service_name, s.price_from, s.duration
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE b.booking_ref = ?
  `).get(bookingRef);

  res.status(201).json({ booking_ref: bookingRef, booking });
});

// ─────────────────────────────────────────
// GET /api/bookings (admin)
// ─────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { date, nailer_id, status, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT b.*, n.name as nailer_name, n.emoji as nailer_emoji,
           s.name as service_name, s.price_from
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE 1=1
  `;

  const params = [];

  if (date) {
    query += ' AND b.date = ?';
    params.push(date);
  }

  if (nailer_id) {
    query += ' AND b.nailer_id = ?';
    params.push(nailer_id);
  }

  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }

  query += ' ORDER BY b.date DESC, b.time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

// ─────────────────────────────────────────
// GET /api/bookings/today
// ─────────────────────────────────────────
router.get('/today', authMiddleware, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const bookings = db.prepare(`
    SELECT b.*, n.name as nailer_name, n.emoji as nailer_emoji,
           s.name as service_name, s.price_from, s.duration
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE b.date = ? AND b.status != 'cancelled'
    ORDER BY b.time
  `).all(today);

  res.json(bookings);
});

// ─────────────────────────────────────────
// GET /api/bookings/stats (FIXED)
// ─────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const todayCount = db.prepare(`
    SELECT COUNT(*) as c 
    FROM bookings 
    WHERE date = ? AND status IN ('confirmed', 'completed')
  `).get(today).c;

  const monthCount = db.prepare(`
    SELECT COUNT(*) as c 
    FROM bookings 
    WHERE date >= ? AND status IN ('confirmed', 'completed')
  `).get(monthStart).c;

  const expectedRevenue = db.prepare(`
    SELECT COALESCE(SUM(s.price_from), 0) as total
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.date >= ? AND b.status = 'confirmed'
  `).get(today).total;

  const actualRevenue = db.prepare(`
    SELECT COALESCE(SUM(final_price), 0) as total
    FROM bookings
    WHERE status = 'completed'
      AND paid_at >= ?
  `).get(monthStart).total;

  const totalCustomers = db.prepare(`
    SELECT COUNT(*) as c FROM customers
  `).get().c;

  const upcomingCount = db.prepare(`
    SELECT COUNT(*) as c 
    FROM bookings 
    WHERE date > ? AND status = 'confirmed'
  `).get(today).c;

  res.json({
    today_bookings: todayCount,
    month_bookings: monthCount,
    expected_revenue: expectedRevenue,
    actual_revenue: actualRevenue,
    total_customers: totalCustomers,
    upcoming_bookings: upcomingCount
  });
});

// ─────────────────────────────────────────
// GET /api/bookings/ref/:ref
// ─────────────────────────────────────────
router.get('/ref/:ref', (req, res) => {
  const booking = db.prepare(`
    SELECT b.*, n.name as nailer_name, n.emoji as nailer_emoji,
           s.name as service_name, s.price_from, s.duration
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE b.booking_ref = ?
  `).get(req.params.ref);

  if (!booking) {
    return res.status(404).json({ error: 'Buchung nicht gefunden.' });
  }

  res.json(booking);
});

// ─────────────────────────────────────────
// GET /api/bookings/:id
// ─────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const booking = db.prepare(`
    SELECT b.*, n.name as nailer_name, n.emoji as nailer_emoji,
           s.name as service_name, s.price_from, s.duration
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'Buchung nicht gefunden.' });
  }

  res.json(booking);
});

// ─────────────────────────────────────────
// PATCH /api/bookings/:id/status (FIXED)
// ─────────────────────────────────────────
router.patch('/:id/status', authMiddleware, (req, res) => {
  const { status, final_price } = req.body;

  const allowed = ['confirmed', 'cancelled', 'completed', 'no-show'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status.' });
  }

  const booking = db.prepare(`
    SELECT * FROM bookings WHERE id = ?
  `).get(req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'Buchung nicht gefunden.' });
  }

  const update = db.transaction(() => {

    if (status === 'completed') {
      if (!final_price) {
        throw new Error('final_price is required');
      }

      db.prepare(`
        UPDATE bookings 
        SET status = 'completed',
            final_price = ?,
            paid_at = datetime('now')
        WHERE id = ?
      `).run(final_price, req.params.id);

      db.prepare(`
        UPDATE customers
        SET total_spent = COALESCE(total_spent, 0) + ?
        WHERE phone = ?
      `).run(final_price, booking.customer_phone);

    } else {
      db.prepare(`
        UPDATE bookings SET status = ? WHERE id = ?
      `).run(status, req.params.id);
    }

    if (status === 'cancelled' && booking.slot_id) {
      db.prepare(`
        UPDATE slots SET is_booked = 0 WHERE id = ?
      `).run(booking.slot_id);
    }
  });

  try {
    update();
    res.json({ message: 'Status aktualisiert.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/bookings/:id
// ─────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { note, status } = req.body;

  const booking = db.prepare(`
    SELECT id FROM bookings WHERE id = ?
  `).get(req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'Buchung nicht gefunden.' });
  }

  db.prepare(`
    UPDATE bookings 
    SET note=?, status=? 
    WHERE id=?
  `).run(note, status, req.params.id);

  res.json({ message: 'Buchung aktualisiert.' });
});

module.exports = router;