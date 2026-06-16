export default function handler(req, res) {
  res.status(200).json({
    SMTP_HOST: Boolean(process.env.SMTP_HOST),
    SMTP_USER: Boolean(process.env.SMTP_USER),
    SMTP_PASS: Boolean(process.env.SMTP_PASS),
    MAIL_FROM: Boolean(process.env.MAIL_FROM),
    SMTP_PORT: Boolean(process.env.SMTP_PORT),
    SMTP_SECURE: Boolean(process.env.SMTP_SECURE),
    GOVERNOR_EMAIL: Boolean(process.env.GOVERNOR_EMAIL)
  });
}
