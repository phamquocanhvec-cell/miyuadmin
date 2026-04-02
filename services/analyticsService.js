// services/analyticsService.js

/**
 * MIYU Analytics Service
 * Luxury KPI + CRM insights
 */

async function getDashboardStats(db) {
  // ─────────────────────────────────────────────
  // BASIC STATS
  // ─────────────────────────────────────────────

  const [[today]] = await db.query(`
    SELECT COUNT(*) as total
    FROM bookings
    WHERE date = CURDATE()
  `);

  const [[month]] = await db.query(`
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(price_from),0) as revenue
    FROM bookings
    WHERE MONTH(date) = MONTH(CURDATE())
      AND YEAR(date) = YEAR(CURDATE())
      AND status = 'completed'
  `);

  const [[customers]] = await db.query(`
    SELECT COUNT(*) as total FROM customers
  `);

  // ─────────────────────────────────────────────
  // CUSTOMER TIERS (VIP / Stamm / Regular / New)
  // ─────────────────────────────────────────────

  const [tiers] = await db.query(`
    SELECT status, COUNT(*) as count
    FROM customers
    GROUP BY status
  `);

  const tierMap = {
    vip: 0,
    stamm: 0,
    regular: 0,
    new: 0
  };

  tiers.forEach(t => {
    if (tierMap[t.status] !== undefined) {
      tierMap[t.status] = t.count;
    }
  });

  // ─────────────────────────────────────────────
  // TOP SERVICES
  // ─────────────────────────────────────────────

  const [topServices] = await db.query(`
    SELECT service_name, COUNT(*) as total
    FROM bookings
    WHERE status = 'completed'
    GROUP BY service_name
    ORDER BY total DESC
    LIMIT 5
  `);

  // ─────────────────────────────────────────────
  // TOP NAIL ARTISTS
  // ─────────────────────────────────────────────

  const [topNailers] = await db.query(`
    SELECT nailer_name, COUNT(*) as total
    FROM bookings
    WHERE status = 'completed'
    GROUP BY nailer_name
    ORDER BY total DESC
    LIMIT 5
  `);

  // ─────────────────────────────────────────────
  // REVENUE BY DAY (last 7 days)
  // ─────────────────────────────────────────────

  const [revenue7d] = await db.query(`
    SELECT 
      DATE(date) as day,
      COALESCE(SUM(price_from),0) as revenue
    FROM bookings
    WHERE date >= CURDATE() - INTERVAL 6 DAY
      AND status = 'completed'
    GROUP BY DATE(date)
    ORDER BY day ASC
  `);

  // Fill missing days (important for chart)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    const found = revenue7d.find(r => r.day.toISOString().slice(0,10) === key);

    last7Days.push({
      date: key,
      revenue: found ? Number(found.revenue) : 0
    });
  }

  // ─────────────────────────────────────────────
  // UPCOMING BOOKINGS
  // ─────────────────────────────────────────────

  const [[upcoming]] = await db.query(`
    SELECT COUNT(*) as total
    FROM bookings
    WHERE date >= CURDATE()
      AND status = 'confirmed'
  `);

  // ─────────────────────────────────────────────
  // FINAL RESPONSE
  // ─────────────────────────────────────────────

  return {
    overview: {
      todayBookings: today.total,
      monthBookings: month.total,
      monthRevenue: Number(month.revenue),
      totalCustomers: customers.total,
      upcomingBookings: upcoming.total
    },

    customerTiers: tierMap,

    topServices: topServices.map(s => ({
      name: s.service_name,
      total: s.total
    })),

    topNailers: topNailers.map(n => ({
      name: n.nailer_name,
      total: n.total
    })),

    revenue7d: last7Days
  };
}

module.exports = {
  getDashboardStats
};