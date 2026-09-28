const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('./logger');

const smtpUser = config.SMTP_USER;
const smtpPass = config.SMTP_PASS;
const isConfigured = Boolean(smtpUser && smtpPass && smtpUser !== 'your-email@gmail.com');

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST || 'smtp.gmail.com',
    port: Number(config.SMTP_PORT) || 587,
    secure: false, // STARTTLS
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  // Verify connection configuration on boot (log only, never throw)
  if (!config.isTest) {
    transporter.verify((error) => {
      if (error) {
        logger.warn({ err: error }, '[Mailer] SMTP verification failed');
      } else {
        logger.info('✓ [Mailer] SMTP transporter configured and verified');
      }
    });
  }
}

/**
 * Send a 6-digit OTP email.
 * @param {string} to      - recipient email address
 * @param {string} otp     - plain-text OTP to embed in the email
 * @param {'register'|'delete'} purpose
 */
async function sendOtpEmail(to, otp, purpose = 'register') {
  const isDelete = purpose === 'delete';
  const isProd = config.isProduction;

  // Only print OTP to console when not in production
  if (!isProd) {
    logger.info({ to, purpose }, '[OTP] Verification code generated');
  }

  if (!isConfigured || !transporter) {
    if (isProd) {
      const err = new Error('Email service is not configured.');
      err.statusCode = 503;
      err.code = 'MAIL_SERVICE_UNAVAILABLE';
      throw err;
    }
    logger.warn('[Mailer] SMTP not configured. OTP logged for dev use.');
    return { dev: true, otp };
  }

  const subject = isDelete
    ? 'TravelSync – Confirm Account Deletion'
    : 'TravelSync – Verify Your Email';

  const action = isDelete
    ? 'permanently delete your TravelSync account'
    : 'complete your TravelSync registration';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;
                background:#0f172a;border-radius:16px;overflow:hidden;
                border:1px solid rgba(255,255,255,0.08);">
      <div style="background:linear-gradient(135deg,#00355f,#006970);
                  padding:32px 40px 24px;text-align:center;">
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.02em;">
          TravelSync
        </h1>
      </div>
      <div style="padding:40px;">
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px;">
          You requested to <strong>${action}</strong>.<br>
          Use the verification code below. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#1e293b;border-radius:12px;padding:28px;
                    text-align:center;margin:24px 0;
                    border:1px solid rgba(255,255,255,0.07);">
          <p style="color:#94a3b8;font-size:12px;font-weight:700;
                    letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">
            Verification Code
          </p>
          <span style="font-size:42px;font-weight:800;letter-spacing:10px;
                       color:#38bdf8;font-variant-numeric:tabular-nums;">
            ${otp}
          </span>
        </div>
        ${isDelete ? `<p style="color:#fca5a5;font-size:13px;margin:0 0 20px;">
          ⚠️ This action is <strong>permanent and cannot be undone</strong>.
        </p>` : ''}
        <p style="color:#64748b;font-size:12px;margin:0;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
      <div style="padding:16px 40px;background:#0a0f1e;text-align:center;">
        <p style="color:#475569;font-size:11px;margin:0;">
          © ${new Date().getFullYear()} TravelSync. All rights reserved.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM || `"TravelSync" <${smtpUser}>`,
      to,
      subject,
      html
    });
    return { success: true };
  } catch (mailErr) {
    logger.error({ err: mailErr }, '[Mailer] Failed to send email via SMTP');
    // If SMTP fails in non-production, don't crash — let the user use the console code!
    if (!config.isProduction) {
      return { dev: true, otp };
    }
    const err = new Error('Failed to deliver email through mail service.');
    err.statusCode = 502;
    err.code = 'MAIL_DELIVERY_FAILED';
    throw err;
  }
}

module.exports = { sendOtpEmail };
