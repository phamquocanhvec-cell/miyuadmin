const express = require('express');
const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const db = req.app.get('db');

    const revenue = await db('bookings')
      .where({ status: 'completed' })
      .sum('price as total');

    const bookings = await db('bookings')
      .count('* as count');

    const repeatCustomers = await db('customers')
      .where('total_bookings', '>', 1)
      .count('* as count');

    const topServices = await db('bookings')
      .select('service_name')
      .count('* as count')
      .groupBy('service_name')
      .orderBy('count', 'desc')
      .limit(5);

    res.json({
      revenue: Number(revenue[0].total) || 0,
      bookings: Number(bookings[0].count),
      repeatCustomers: Number(repeatCustomers[0].count),
      topServices
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;