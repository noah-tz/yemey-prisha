'use strict';

const nodemailer = require('nodemailer');

// Brevo SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

/**
 * Send an email.
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} htmlBody - email body in HTML
 * @returns {Promise}
 */
async function sendReminder(to, subject, htmlBody) {
  const mailOptions = {
    from: '"לוח וסתות" <noreply@veset.dina-ins.co.il>',
    to: to,
    subject: subject,
    html: htmlBody
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendReminder };
