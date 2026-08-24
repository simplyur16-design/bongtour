import nodemailer from "nodemailer";

const FROM_NAME = "simplyur";

export async function sendSimplyurMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    cid: string;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const secure = process.env.SMTP_SECURE === "true";
  const port = Number(portRaw || (secure ? 465 : 587));

  if (!host || !portRaw || !user || !pass || !fromEmail) {
    return { ok: false, error: "smtp_not_configured" };
  }
  if (!Number.isFinite(port) || port <= 0) {
    return { ok: false, error: "smtp_port_invalid" };
  }

  const to = input.to.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "invalid_recipient" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
    });
    await transporter.sendMail({
      from: { name: FROM_NAME, address: fromEmail },
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return { ok: false, error: msg.slice(0, 500) };
  }
}
