import nodemailer from "nodemailer";

export type SendPressOtpMailInput = {
  to: string;
  code: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPressOtpMailContent(input: SendPressOtpMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const code = input.code.trim();
  const subject = "[Bong투어] 직군(언론사) 직장 이메일 인증번호";
  const text = [
    "직군 회원 인증을 위한 인증번호입니다.",
    "",
    `인증번호: ${code}`,
    "유효 시간: 10분",
    "",
    "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
  ].join("\n");
  const safeCode = escapeHtml(code);
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e293b;line-height:1.6;">
  <p>직군 회원 인증을 위한 인증번호입니다.</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;color:#534AB7;">${safeCode}</p>
  <p style="font-size:14px;color:#64748b;">유효 시간 10분 · 본인이 요청하지 않았다면 무시해 주세요.</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendPressOtpMail(
  input: SendPressOtpMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim();
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const secure = process.env.SMTP_SECURE === "true";
  const port = Number(portRaw || (secure ? 465 : 587));

  if (!host || !portRaw || !user || !pass || !fromName || !fromEmail) {
    return { ok: false, error: "smtp_not_configured" };
  }
  if (!Number.isFinite(port) || port <= 0) {
    return { ok: false, error: "smtp_port_invalid" };
  }

  const to = input.to.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "invalid_recipient" };
  }

  const { subject, text, html } = buildPressOtpMailContent(input);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
    });
    await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return { ok: false, error: msg.slice(0, 500) };
  }
}
