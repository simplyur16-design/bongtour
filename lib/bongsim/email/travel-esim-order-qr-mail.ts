import nodemailer from "nodemailer";

import { BONGSIM_ESIM_SUPPORT_EMAIL_LINE, BONGSIM_KAKAO_CHANNEL_URL } from "@/lib/bongsim/constants";

export type TravelEsimOrderQrMailInput = {
  to: string;
  orderNumber: string;
  qrCodeUrl: string;
  downloadLink: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTravelEsimOrderQrMailContent(input: TravelEsimOrderQrMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const orderNumber = input.orderNumber.trim();
  const subject = `[Bong투어] eSIM 설치 안내 (주문 ${orderNumber})`;
  const qr = input.qrCodeUrl.trim();
  const dl = input.downloadLink.trim();

  const text = [
    "결제가 완료되었습니다. eSIM 설치 안내를 보내드립니다.",
    "",
    `주문번호: ${orderNumber}`,
    "",
    "QR 코드 이미지:",
    qr,
    "",
    "설치(다운로드) 링크:",
    dl,
    "",
    BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
    BONGSIM_KAKAO_CHANNEL_URL.trim() ? `카카오 채널: ${BONGSIM_KAKAO_CHANNEL_URL.trim()}` : "",
    "",
    "Bong투어 드림",
  ]
    .filter(Boolean)
    .join("\n");

  const safeOrder = escapeHtml(orderNumber);
  const safeQr = escapeHtml(qr);
  const safeDl = escapeHtml(dl);
  const safeSupport = escapeHtml(BONGSIM_ESIM_SUPPORT_EMAIL_LINE);
  const kakaoLine = BONGSIM_KAKAO_CHANNEL_URL.trim()
    ? `<p style="margin:12px 0 0;font-size:14px;color:#334155;">카카오: <a href="${escapeHtml(BONGSIM_KAKAO_CHANNEL_URL.trim())}" style="color:#0f766e;">채널 바로가기</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:24px;background:#f8fafc;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">eSIM 설치 안내</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">주문번호 <strong>${safeOrder}</strong> 결제가 완료되었습니다.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">QR 코드</p>
    <p style="margin:0 0 16px;"><a href="${safeQr}" style="color:#0f766e;word-break:break-all;">${safeQr}</a></p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">설치 링크</p>
    <p style="margin:0 0 16px;"><a href="${safeDl}" style="color:#0f766e;word-break:break-all;">${safeDl}</a></p>
    <p style="margin:0;font-size:13px;color:#64748b;">${safeSupport}</p>
    ${kakaoLine}
  </div>
</body></html>`;

  return { subject, text, html };
}

export async function sendTravelEsimOrderQrMail(
  input: TravelEsimOrderQrMailInput,
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

  const { subject, text, html } = buildTravelEsimOrderQrMailContent(input);

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
