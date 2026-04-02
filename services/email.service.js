const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function sendBirthdayEmail(customer) {
  const html = `
    <div style="font-family:Arial;padding:30px;background:#fff0f5;">
      <h2 style="color:#c9a96e;">Happy Birthday ${customer.first_name} 💖</h2>
      <p>MIYU chúc bạn một ngày thật xinh đẹp ✨</p>
      <p style="margin-top:10px;">🎁 Tặng bạn <b>10% OFF</b> cho lần hẹn tiếp theo</p>
      <p style="margin-top:20px;">Hẹn gặp lại tại MIYU 💅</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"MIYU Studio" <${process.env.GMAIL_USER}>`,
    to: customer.email,
    subject: 'Happy Birthday from MIYU 💅',
    html
  });
}

module.exports = { sendBirthdayEmail };