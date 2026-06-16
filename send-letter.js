const nodemailer = require('nodemailer');
const { sendJson, readJsonBody, GOVERNOR_EMAIL } = require('./_shared');

function validateSubmission(body) {
  const required = ['firstName', 'lastName', 'email', 'street', 'city', 'state', 'zip', 'letter', 'legislators'];
  for (const field of required) if (!body[field]) return `${field} is required.`;
  if (!Array.isArray(body.legislators) || body.legislators.length === 0) return 'At least one legislator recipient is required.';
  return null;
}

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.MAIL_FROM) {
    throw new Error('Email sending is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM in Vercel Environment Variables.');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });

  try {
    const body = await readJsonBody(req);
    const error = validateSubmission(body || {});
    if (error) return sendJson(res, 400, { error });

    const { firstName, lastName, email, phone, street, city, state, zip, letter, legislators } = body;
    const transporter = createTransporter();

    const legislatorRecipients = legislators.map(l => `${l.title} ${l.full_name} <${l.email}>`);
    const to = [...legislatorRecipients, `Governor of Pennsylvania <${GOVERNOR_EMAIL}>`].join(', ');
    const cc = process.env.ORGANIZATION_CC_EMAIL || undefined;
    const submittedBy = `${firstName} ${lastName}\n${street}\n${city}, ${state} ${zip}\n${email}${phone ? `\n${phone}` : ''}`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      replyTo: `${firstName} ${lastName} <${email}>`,
      to,
      cc,
      subject: 'Please Prioritize Equitable Nursing Home Funding in This Year’s State Budget',
      text: `${letter}\n\n---\nSubmitted by:\n${submittedBy}`
    });

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('send-letter failed:', error);
    return sendJson(res, 500, { error: error.message });
  }
};
