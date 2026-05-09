const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a 6-digit OTP email.
 * @param {string} to      - recipient email address
 * @param {string} otp     - plain-text OTP to embed in the email
 * @param {'register'|'delete'} purpose
 */
async function sendOtpEmail(to, otp, purpose = 'register') {
  const isDelete = purpose === 'delete';

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
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#00355f,#006970);
                  padding:32px 40px 24px;text-align:center;">
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.02em;">
          TravelSync
        </h1>
      </div>
      <!-- Body -->
      <div style="padding:40px;">
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px;">
          You requested to <strong>${action}</strong>.<br>
          Use the verification code below. It expires in <strong>10 minutes</strong>.
        </p>
        <!-- OTP Box -->
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
          If you did not request this, ignore this email and your account is safe.
        </p>` : ''}
        <p style="color:#64748b;font-size:12px;margin:0;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
      <!-- Footer -->
      <div style="padding:16px 40px;background:#0a0f1e;text-align:center;">
        <p style="color:#475569;font-size:11px;margin:0;">
          © ${new Date().getFullYear()} TravelSync. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'TravelSync <noreply@travelsync.app>',
    to,
    subject,
    html,
  });
}

module.exports = { sendOtpEmail };
