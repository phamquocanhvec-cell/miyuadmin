const cron = require('node-cron');
const { sendBirthdayEmail } = require('../services/email.service');

function startBirthdayJob(db) {
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date().toISOString().slice(5, 10); // MM-DD

      const customers = await db('customers')
        .whereRaw("TO_CHAR(birthday, 'MM-DD') = ?", [today]);

      for (const c of customers) {
        if (c.email) {
          await sendBirthdayEmail(c);
        }
      }

      console.log('🎂 Sent birthday emails:', customers.length);
    } catch (err) {
      console.error('Birthday cron error:', err);
    }
  });
}

module.exports = { startBirthdayJob };