import nodemailer from "nodemailer";

import { BONGSIM_ESIM_SUPPORT_EMAIL_LINE, USIMSA_CX_CONTACT_URL, USIMSA_CX_KAKAO_CHAT_URL } from "@/lib/bongsim/constants";
import { buildAppleQuickInstallUrl } from "@/lib/bongsim/esim-install-presentation";
import {
  CMLINK_TRAVELER_VERIFICATION_URL,
  TRAVELER_VERIFICATION_ICCID_PREFIX,
  extractIccidPostPrefix,
} from "@/lib/bongsim/esim/iccid-verification";

export type TravelEsimOrderQrMailInput = {
  to: string;
  orderNumber: string;
  qrCodeUrl: string;
  /** LPA:1$… — iPhone 원클릭 URL 파생용 (본문 LPA 노출 아님) */
  downloadLink: string;
  smDpPlusAddress?: string | null;
  activationCode?: string | null;
  orderPageUrl: string;
  travelerVerificationIccid?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchQrInlineAttachment(
  qrUrl: string,
): Promise<{ content: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(qrUrl, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) return null;
    const contentType = (res.headers.get("content-type") ?? "image/png").split(";")[0]?.trim() || "image/png";
    return { content: buf, contentType };
  } catch {
    return null;
  }
}

const QR_IMG_ATTRS =
  'alt="eSIM 설치 QR 코드" width="240" height="240" style="display:block;max-width:240px;height:auto;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;"';

function buildQrImgHtml(safeQrUrl: string, imgSrc: string): string {
  return `<img src="${imgSrc}" ${QR_IMG_ATTRS} />
       <p style="margin:8px 0 0;font-size:12px;color:#64748b;text-align:center;">이미지가 보이지 않으면 <a href="${safeQrUrl}" style="color:#0f766e;">QR 열기</a> 또는 주문 페이지를 이용해 주세요.</p>`;
}

function buildTravelerVerificationEmailBlock(iccid: string): { html: string; text: string } {
  const postPrefix = extractIccidPostPrefix(iccid);
  if (!postPrefix) return { html: "", text: "" };

  const safePrefix = escapeHtml(TRAVELER_VERIFICATION_ICCID_PREFIX);
  const safePost = escapeHtml(postPrefix);
  const safeCmlink = escapeHtml(CMLINK_TRAVELER_VERIFICATION_URL);

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0;border-collapse:collapse;">
  <tr>
    <td style="padding:16px;border:1px solid #fcd34d;border-radius:12px;background:#fffbeb;">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">여행자 인증이 필요합니다</p>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">이 eSIM은 사용 전 CMLink에서 여행자 인증을 진행해 주세요.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:12px;border:1px solid #fde68a;border-radius:8px;background:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.5;word-break:break-all;">
            <span style="color:#94a3b8;">${safePrefix}</span><strong style="color:#0f172a;">${safePost}</strong>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b;">ICCID 뒷부분 복사는 마이페이지 또는 주문 완료 페이지에서 할 수 있습니다.</p>
      <p style="margin:16px 0 0;text-align:center;">
        <a href="${safeCmlink}" style="display:inline-block;padding:12px 20px;background:#1F1B2D;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">CMLink에서 인증하기</a>
      </p>
    </td>
  </tr>
</table>`;

  const text = [
    "── 여행자 인증 ──",
    "이 eSIM은 사용 전 CMLink에서 여행자 인증을 진행해 주세요.",
    `ICCID: ${TRAVELER_VERIFICATION_ICCID_PREFIX}${postPrefix}`,
    "ICCID 뒷부분 복사는 마이페이지 또는 주문 완료 페이지에서 할 수 있습니다.",
    `CMLink: ${CMLINK_TRAVELER_VERIFICATION_URL}`,
  ].join("\n");

  return { html, text };
}

export type TravelEsimOrderQrMailBuildOptions = {
  /** `cid:esimqr` (인라인 첨부) 또는 이스케이프된 https QR URL (직접 로드) */
  qrImgSrc?: string;
};

export function buildTravelEsimOrderQrMailContent(
  input: TravelEsimOrderQrMailInput,
  options?: TravelEsimOrderQrMailBuildOptions,
): {
  subject: string;
  text: string;
  html: string;
} {
  const orderNumber = input.orderNumber.trim();
  const subject = `[Bong투어] eSIM 설치 안내 (주문 ${orderNumber})`;
  const qr = input.qrCodeUrl.trim();
  const lpa = input.downloadLink.trim();
  const orderPage = input.orderPageUrl.trim();
  const appleUrl = lpa ? buildAppleQuickInstallUrl(lpa) : null;
  const smDp = input.smDpPlusAddress?.trim() || "";
  const activationCode = input.activationCode?.trim() || "";
  const verificationIccid = input.travelerVerificationIccid?.trim() || "";
  const verificationBlock = verificationIccid
    ? buildTravelerVerificationEmailBlock(verificationIccid)
    : { html: "", text: "" };

  const text = [
    "결제가 완료되었습니다. eSIM 설치 안내를 보내드립니다.",
    "",
    `주문번호: ${orderNumber}`,
    "",
    "아래 주문 페이지에서 QR 코드를 스캔해 주세요.",
    orderPage,
    "",
    qr ? `QR 이미지(백업 URL): ${qr}` : "",
    smDp ? `SM-DP+ 주소: ${smDp}` : "",
    activationCode ? `활성화 코드: ${activationCode}` : "",
    appleUrl ? `iPhone 바로 설치: ${appleUrl}` : "",
    verificationBlock.text ? ["", verificationBlock.text].join("\n") : "",
    "",
    "── 설치·사용 문의 ──",
    "eSIM 전문 파트너 유심사가 설치·사용을 직접 지원합니다.",
    `카카오톡 문의: ${USIMSA_CX_KAKAO_CHAT_URL}`,
    `이메일 문의: ${USIMSA_CX_CONTACT_URL}`,
    `문의 시 주문번호를 알려주세요: ${orderNumber}`,
    "",
    BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
    "",
    "Bong투어 드림",
  ]
    .filter(Boolean)
    .join("\n");

  const safeOrder = escapeHtml(orderNumber);
  const safeQr = escapeHtml(qr);
  const safeOrderPage = escapeHtml(orderPage);
  const safeSupport = escapeHtml(BONGSIM_ESIM_SUPPORT_EMAIL_LINE);
  const safeSmDp = escapeHtml(smDp);
  const safeActivationCode = escapeHtml(activationCode);
  const safeUsimsaKakao = escapeHtml(USIMSA_CX_KAKAO_CHAT_URL);
  const safeUsimsaContact = escapeHtml(USIMSA_CX_CONTACT_URL);

  const qrImgSrc = options?.qrImgSrc?.trim() ?? "";
  const qrImgHtml = qr && qrImgSrc ? buildQrImgHtml(safeQr, qrImgSrc) : "";

  const appleBtn = appleUrl
    ? `<p style="margin:16px 0 0;text-align:center;"><a href="${escapeHtml(appleUrl)}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">iPhone에서 바로 설치</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:24px;background:#f8fafc;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">eSIM 설치 안내</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">주문번호 <strong>${safeOrder}</strong> 결제가 완료되었습니다.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">QR 코드 스캔</p>
    <div style="margin:0 0 16px;text-align:center;">${qrImgHtml}</div>
    ${verificationBlock.html}
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">주문 페이지에서 QR 보기</p>
    <p style="margin:0 0 16px;"><a href="${safeOrderPage}" style="color:#0f766e;word-break:break-all;">${safeOrderPage}</a></p>
    ${
      smDp || activationCode
        ? `<p style="margin:0 0 8px;font-size:14px;color:#475569;">수동 설치 (QR 스캔이 어려울 때)</p>
    ${
      smDp
        ? `<p style="margin:0 0 4px;font-size:13px;color:#475569;">SM-DP+ 주소</p>
    <pre style="margin:0 0 12px;padding:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:#0f172a;">${safeSmDp}</pre>`
        : ""
    }
    ${
      activationCode
        ? `<p style="margin:0 0 4px;font-size:13px;color:#475569;">활성화 코드</p>
    <pre style="margin:0 0 16px;padding:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:#0f172a;">${safeActivationCode}</pre>`
        : ""
    }`
        : ""
    }
    ${appleBtn}
    <div style="margin:20px 0 0;padding:16px;border:1px solid #99f6e4;border-radius:12px;background:#f0fdfa;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f766e;">설치·사용 문의</p>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#334155;">eSIM 전문 파트너 유심사가 설치·사용을 직접 지원합니다.</p>
      <p style="margin:0 0 10px;text-align:center;">
        <a href="${safeUsimsaKakao}" style="display:inline-block;padding:12px 20px;background:#FEE500;color:#191919;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">카카오톡 문의하기</a>
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#475569;">이메일 문의</p>
      <p style="margin:0 0 12px;"><a href="${safeUsimsaContact}" style="color:#0f766e;word-break:break-all;">${safeUsimsaContact}</a></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#334155;">문의 시 주문번호를 알려주세요: <strong>${safeOrder}</strong></p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">${safeSupport}</p>
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

  const qrUrl = input.qrCodeUrl.trim();
  const inline = qrUrl ? await fetchQrInlineAttachment(qrUrl) : null;
  const qrImgSrc = qrUrl ? (inline ? "cid:esimqr" : escapeHtml(qrUrl)) : "";
  const { subject, text, html } = buildTravelEsimOrderQrMailContent(input, {
    qrImgSrc: qrImgSrc || undefined,
  });

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
      attachments: inline
        ? [
            {
              filename: "esim-qr.png",
              content: inline.content,
              contentType: inline.contentType,
              cid: "esimqr",
            },
          ]
        : undefined,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return { ok: false, error: msg.slice(0, 500) };
  }
}
