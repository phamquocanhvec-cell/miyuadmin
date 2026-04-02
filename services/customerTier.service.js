// services/customerTier.js

function calculateCustomerTier(customer) {
  const bookings = customer.total_bookings || 0;
  const revenue = customer.total_spent || 0;

  if (bookings >= 15 || revenue >= 1000) return 'vip';
  if (bookings >= 8 || revenue >= 500) return 'stamm';
  if (bookings >= 3) return 'regular';
  return 'new';
}

async function updateCustomerTier(db, customerId) {
  const [customer] = await db.query(
    `SELECT 
      c.id,
      COUNT(b.id) as total_bookings,
      COALESCE(SUM(b.price_from),0) as total_spent
     FROM customers c
     LEFT JOIN bookings b ON b.customer_id = c.id AND b.status = 'completed'
     WHERE c.id = ?
     GROUP BY c.id`,
    [customerId]
  );

  if (!customer.length) return;

  const tier = calculateCustomerTier(customer[0]);

  await db.query(
    'UPDATE customers SET status = ? WHERE id = ?',
    [tier, customerId]
  );

  return tier;
}

module.exports = {
  calculateCustomerTier,
  updateCustomerTier
};