import "server-only";

import nodemailer from "nodemailer";

export async function sendReportEmail(input: {
  subject: string;
  text: string;
}) {
  const host = process.env.ZOHO_SMTP_HOST;
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;
  const to = process.env.REPORT_EMAIL_TO;
  const port = Number(process.env.ZOHO_SMTP_PORT ?? "465");

  if (!host || !user || !pass || !to) {
    return { skipped: true as const };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject: input.subject,
    text: input.text,
  });

  return { skipped: false as const };
}
