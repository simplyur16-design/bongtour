import nodemailer from "nodemailer";

import {
  BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
  BONGSIM_KAKAO_CHANNEL_URL,
  bongsimPath,
} from "@/lib/bongsim/constants";

export type TravelEsimGratitudeMailInput = {
  to: string;
  recipientName: string | null;
  tripName: string;
  /** YYYY-MM-DD */
  departureDateYmd: string;
  couponCode: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://bongtour.com";
  return raw.replace(/\/$/, "");
}

function buildSubject(): string {
  return "[Bong투어] 여행 감사 이벤트 — eSIM 무료 쿠폰이 도착했어요";
}

function formatDepartureKo(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return ymd;
  }
}

export function buildTravelEsimGratitudeMailContent(input: TravelEsimGratitudeMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = buildSubject();
  const name = (input.recipientName ?? "").trim() || "고객";
  const trip = input.tripName.trim();
  const depKo = formatDepartureKo(input.departureDateYmd);
  const code = input.couponCode.trim();
  const esimUrl = `${publicSiteOrigin()}${bongsimPath()}`;

  const text = [
    `${name}님, ${trip} 여행을 예약해주셔서 감사합니다.`,
    "",
    "eSIM 무료 쿠폰을 드립니다.",
    "",
    `쿠폰 코드: ${code}`,
    "",
    "사용 방법:",
    `1) ${esimUrl} 에서 원하시는 eSIM 상품을 선택합니다.`,
    "2) 결제 단계에서 쿠폰 코드를 입력합니다.",
    "",
    `유효기간: ${depKo}까지 (출발일 기준)`,
    "",
    BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
    BONGSIM_KAKAO_CHANNEL_URL.trim() ? `카카오 채널: ${BONGSIM_KAKAO_CHANNEL_URL.trim()}` : "",
    "",
    "즐거운 여행 되세요.",
    "Bong투어 드림",
  ]
    .filter(Boolean)
    .join("\n");

  const logoUrl = `${publicSiteOrigin()}/images/logo-transparent.webp`;
  const safeName = escapeHtml(name);
  const safeTrip = escapeHtml(trip);
  const safeCode = escapeHtml(code);
  const safeDep = escapeHtml(depKo);
  const safeEsimUrl = escapeHtml(esimUrl);
  const safeSupport = escapeHtml(BONGSIM_ESIM_SUPPORT_EMAIL_LINE);
  const kakaoLine = BONGSIM_KAKAO_CHANNEL_URL.trim()
    ? `<p style="margin:12px 0 0;font-size:14px;color:#334155;">카카오: <a href="${escapeHtml(BONGSIM_KAKAO_CHANNEL_URL.trim())}" style="color:#0f766e;">채널 바로가기</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:20px 24px;text-align:center;">
          <img src="${escapeHtml(logoUrl)}" alt="Bong투어" width="160" height="auto" style="display:inline-block;max-width:160px;height:auto;" />
        </td></tr>
        <tr><td style="padding:28px 24px;color:#0f172a;">
          <p style="margin:0 0 16px;font-size:17px;line-height:1.55;font-weight:600;">${safeName}님, ${safeTrip} 여행을 예약해주셔서 감사합니다.</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">eSIM 무료 쿠폰을 드립니다.</p>
          <div style="margin:20px 0;padding:18px 16px;background:#f0fdfa;border:1px dashed #14b8a6;border-radius:10px;text-align:center;">
            <div style="font-size:12px;color:#0f766e;font-weight:600;letter-spacing:0.05em;">쿠폰 코드</div>
            <div style="margin-top:8px;font-size:22px;font-weight:800;letter-spacing:0.12em;font-family:ui-monospace,Menlo,monospace;color:#0f172a;">${safeCode}</div>
          </div>
          <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:#0f172a;">사용 방법</p>
          <ol style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.65;">
            <li><a href="${safeEsimUrl}" style="color:#0f766e;">봉심 eSIM 스토어</a>에서 상품을 선택합니다.</li>
            <li>결제 시 쿠폰 코드를 입력합니다.</li>
          </ol>
          <p style="margin:20px 0 0;font-size:14px;color:#475569;"><strong>유효기간:</strong> ${safeDep}까지</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
          <p style="margin:0;font-size:14px;color:#334155;">${safeSupport}</p>
          ${kakaoLine}
          <p style="margin:24px 0 0;font-size:13px;color:#64748b;">Bong투어 드림</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendTravelEsimGratitudeCouponMail(
  input: TravelEsimGratitudeMailInput,
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

  const { subject, text, html } = buildTravelEsimGratitudeMailContent({ ...input, to });

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
