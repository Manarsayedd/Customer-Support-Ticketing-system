const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

app.post('/notify', async (req, res) => {
    const { message, ticketId, email } = req.body;

    console.log(`[NOTIFICATION] Ticket #${ticketId} | ${message}`);

    if (email) {
        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: email,
                subject: `Ticket #${ticketId} Update`,
                text: message,
                html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0d0f1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f1a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#131625;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <div style="font-size:32px;margin-bottom:10px;">🎫</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Support Hub</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Ticket Status Update</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;">Hi there,</p>
              <p style="margin:0 0 28px;color:#e2e8f0;font-size:15px;line-height:1.7;">${message}</p>

              <!-- Ticket ID badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.28);border-radius:8px;padding:12px 20px;">
                    <span style="color:#818cf8;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Ticket ID</span>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700;">#${ticketId}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                If you have questions, reply to this email or visit your portal to track progress in real time.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© Support Hub · You received this because you submitted a support ticket.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
            });
            console.log(`[EMAIL SENT] to ${email}`);
        } catch (err) {
            console.error(`[EMAIL ERROR] Failed to send to ${email}:`, err.message);
        }
    }

    res.status(200).json({ status: 'Notification sent' });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));
