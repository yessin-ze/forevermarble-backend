const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// ── Rate limiter: max 5 submissions per IP per 15 min ───────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── Nodemailer transporter ───────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Input validation ─────────────────────────────────────────
function validateBody({ name, email, phone, message }) {
  const errors = [];
  if (!name || name.trim().length < 2)        errors.push('Name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required.');
  if (!message || message.trim().length < 10)  errors.push('Message must be at least 10 characters.');
  return errors;
}

// ── POST /api/contact ────────────────────────────────────────
router.post('/', limiter, async (req, res) => {
  const { name, email, phone, message, service } = req.body;

  const errors = validateBody({ name, email, phone, message });
  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const transporter = createTransporter();

    // Email to the business
    await transporter.sendMail({
      from: `"Forever Marble Website" <${process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL,
      replyTo: email,
      subject: `New Contact Form Submission — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C5A028; border-bottom: 2px solid #C5A028; padding-bottom: 8px;">
            New Contact Request
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Name</td>
              <td style="padding: 8px;">${escapeHtml(name)}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 8px; font-weight: bold;">Email</td>
              <td style="padding: 8px;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Phone</td>
              <td style="padding: 8px;">${escapeHtml(phone || 'Not provided')}</td>
            </tr>
            ${service ? `
            <tr style="background: #f9f9f9;">
              <td style="padding: 8px; font-weight: bold;">Service</td>
              <td style="padding: 8px;">${escapeHtml(service)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px; font-weight: bold; vertical-align: top;">Message</td>
              <td style="padding: 8px;">${escapeHtml(message).replace(/\n/g, '<br>')}</td>
            </tr>
          </table>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">
            Sent from forevermarble.com contact form
          </p>
        </div>
      `,
    });

    // Auto-reply to the visitor
    await transporter.sendMail({
      from: `"Forever Marble" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'We received your message — Forever Marble',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C5A028;">Thank you, ${escapeHtml(name)}!</h2>
          <p>We've received your message and will get back to you within 1–2 business days.</p>
          <p>If your request is urgent, feel free to call us directly.</p>
          <br>
          <p>— The Forever Marble Team</p>
        </div>
      `,
    });

    res.json({ success: true, message: 'Your message has been sent!' });

  } catch (err) {
    console.error('[Contact] Email send failed:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
