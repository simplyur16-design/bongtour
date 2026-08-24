import {
  buildAndroidQuickInstallUrl,
  buildAppleQuickInstallUrl,
} from "@/lib/bongsim/esim-install-presentation";
import { sendSimplyurMail } from "@/lib/simplyur/email/send-simplyur-mail";

// REGRESSION-FREEZE[simplyur-esim-delivery-install]: simplyur QR mail + OS install links — manifest

export type SimplyurEsimQrMailInput = {
  to: string;
  orderNumber: string;
  qrCodeUrl: string;
  downloadLink: string;
  smDpPlusAddress?: string | null;
  activationCode?: string | null;
  myEsimUrl: string;
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

export function buildSimplyurEsimQrMailContent(input: SimplyurEsimQrMailInput, qrImgSrc?: string): {
  subject: string;
  text: string;
  html: string;
} {
  const orderNumber = input.orderNumber.trim();
  const qr = input.qrCodeUrl.trim();
  const lpa = input.downloadLink.trim();
  const myEsim = input.myEsimUrl.trim();
  const appleUrl = lpa ? buildAppleQuickInstallUrl(lpa) : null;
  const androidUrl = lpa ? buildAndroidQuickInstallUrl(lpa) : null;
  const smDp = input.smDpPlusAddress?.trim() || "";
  const activationCode = input.activationCode?.trim() || "";
  const subject = `simplyur — your Korea eSIM is ready (${orderNumber})`;

  const text = [
    "Your Korea eSIM is ready to install.",
    "",
    `Order: ${orderNumber}`,
    myEsim ? `My eSIM: ${myEsim}` : "",
    appleUrl ? `iPhone install: ${appleUrl}` : "",
    androidUrl ? `Android install: ${androidUrl}` : "",
    qr ? `QR: ${qr}` : "",
    smDp ? `SM-DP+: ${smDp}` : "",
    activationCode ? `Activation code: ${activationCode}` : "",
    "",
    "Install before you need data. The plan starts when the eSIM first connects in Korea.",
    "If you have not registered/installed the eSIM yet, you can cancel unused plans from My eSIM.",
  ]
    .filter(Boolean)
    .join("\n");

  const safeOrder = escapeHtml(orderNumber);
  const safeMyEsim = escapeHtml(myEsim);
  const safeQr = escapeHtml(qr);
  const imgSrc = qrImgSrc || safeQr;
  const qrBlock = qr
    ? `<div style="margin:0 0 16px;text-align:center;">
        <img src="${imgSrc}" alt="eSIM QR" width="240" height="240" style="display:block;max-width:240px;height:auto;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;" />
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;text-align:center;">If the image is missing, <a href="${safeQr}" style="color:#e86a58;">open the QR</a>.</p>
      </div>`
    : "";
  const btn = (href: string, label: string) =>
    `<p style="margin:0 0 10px;text-align:center;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#e86a58;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;">${escapeHtml(label)}</a>
    </p>`;

  const html = `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#FFF7F2;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #f1e4dc;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;color:#e86a58;font-weight:700;">simplyur</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#12233F;">Your Korea eSIM is ready</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c6578;">Order <strong>${safeOrder}</strong>. Tap an install link or scan the QR. You can also open My eSIM in the app or on the web.</p>
    ${appleUrl ? btn(appleUrl, "Install on iPhone") : ""}
    ${androidUrl ? btn(androidUrl, "Install on Android") : ""}
    ${safeMyEsim ? `<p style="margin:0 0 16px;font-size:13px;color:#5c6578;">My eSIM: <a href="${safeMyEsim}" style="color:#e86a58;word-break:break-all;">${safeMyEsim}</a></p>` : ""}
    ${qrBlock}
    ${
      smDp || activationCode
        ? `<p style="margin:0 0 8px;font-size:14px;color:#5c6578;">Manual install</p>
    ${smDp ? `<pre style="margin:0 0 12px;padding:12px;background:#fff7f2;border:1px solid #f1e4dc;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:#12233F;">SM-DP+: ${escapeHtml(smDp)}</pre>` : ""}
    ${activationCode ? `<pre style="margin:0 0 16px;padding:12px;background:#fff7f2;border:1px solid #f1e4dc;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:#12233F;">Activation: ${escapeHtml(activationCode)}</pre>` : ""}`
        : ""
    }
    <p style="margin:0;font-size:12px;line-height:1.5;color:#8a93a3;">Unused eSIMs (not registered / no data used) can be cancelled from My eSIM. Card cancel runs first, then the supplier profile is voided.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

export async function sendSimplyurEsimQrMail(
  input: SimplyurEsimQrMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const qrUrl = input.qrCodeUrl.trim();
  const inline = qrUrl ? await fetchQrInlineAttachment(qrUrl) : null;
  const { subject, text, html } = buildSimplyurEsimQrMailContent(
    input,
    inline ? "cid:esimqr" : undefined,
  );
  return sendSimplyurMail({
    to: input.to,
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
}
