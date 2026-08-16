/* Email worker: polls outgoing_emails table and sends messages via SMTP using nodemailer.

Environment variables (required):
 - SMTP_HOST
 - SMTP_PORT
 - SMTP_USER
 - SMTP_PASS
 - SMTP_SECURE (optional, 'true' or 'false', default false)
 - POLL_INTERVAL_MS (optional, default 30000)
 - MAX_SEND_BATCH (optional, default 20)

Run: node scripts/email-worker.js

Note: this script expects a Prisma model named OutgoingEmail with at least: id, to, subject, body, sentAt, attemptCount, lastError.
*/

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
const MAX_SEND_BATCH = parseInt(process.env.MAX_SEND_BATCH || '20', 10);
const FROM_ADDRESS = process.env.EMAIL_FROM || SMTP_USER || 'no-reply@example.com';

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP configuration. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function sendBatch() {
  try {
    const pending = await prisma.outgoingEmail.findMany({
      where: { sentAt: null },
      orderBy: { createdAt: 'asc' },
      take: MAX_SEND_BATCH,
    });

    if (!pending || pending.length === 0) {
      // nothing to do
      return;
    }

    for (const row of pending) {
      try {
        const mailOptions = {
          from: FROM_ADDRESS,
          to: row.to,
          subject: row.subject || '(no subject)',
          html: row.body || row.text || '',
          text: row.text || undefined,
        };

        await transporter.sendMail(mailOptions);

        await prisma.outgoingEmail.update({
          where: { id: row.id },
          data: { sentAt: new Date(), attemptCount: (row.attemptCount || 0) + 1, lastError: null },
        });

        console.log(`Sent email id=${row.id} to=${row.to}`);
      } catch (err) {
        console.error(`Failed to send email id=${row.id} to=${row.to}`, err?.message ?? err);
        await prisma.outgoingEmail.update({
          where: { id: row.id },
          data: {
            attemptCount: (row.attemptCount || 0) + 1,
            lastError: String(err?.message ?? err),
            lastAttemptAt: new Date(),
          },
        });
      }
    }
  } catch (err) {
    console.error('Worker failed during sendBatch', err?.message ?? err);
  }
}

async function loop() {
  console.log('Email worker started; polling every', POLL_INTERVAL_MS, 'ms');
  while (true) {
    await sendBatch();
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

loop().catch((err) => {
  console.error('Fatal error in email worker', err);
  process.exit(1);
});
