'use strict';

const nodemailer = require('nodemailer');

// Create a transport using SMTP to host Postfix (accessible from Docker via gateway)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '172.22.0.1',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: false,
  tls: { rejectUnauthorized: false }
});

/**
 * Send an email reminder about upcoming prisha days.
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
