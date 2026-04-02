const { calculateCustomerTier } = require('../services/customerTier.service');

async function updateCustomerTier(db, customerId) {
  const customer = await db('customers')
    .where({ id: customerId })
    .first();

  if (!customer) return;

  const newTier = calculateCustomerTier(customer);

  await db('customers')
    .where({ id: customerId })
    .update({ status: newTier });
}

module.exports = { updateCustomerTier };