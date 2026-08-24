import { sendSimplyurMail } from "@/lib/simplyur/email/send-simplyur-mail";

export type SimplyurRefundDoneMailInput = {
  to: string;
  orderNumber: string;
  myEsimUrl: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSimplyurRefundDoneMailContent(input: SimplyurRefundDoneMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const orderNumber = input.orderNumber.trim();
  const myEsim = input.myEsimUrl.trim();
  const subject = `simplyur — refund complete (${orderNumber})`;
  const text = [
    "Your unused eSIM order was cancelled.",
    "",
    `Order: ${orderNumber}`,
    "1) The card payment was reversed.",
    "2) The supplier eSIM profile was cancelled.",
    "",
    myEsim ? `My eSIM: ${myEsim}` : "",
    "The refund may take a few days to show on your card statement.",
  ]
    .filter(Boolean)
    .join("\n");

  const safeOrder = escapeHtml(orderNumber);
  const safeMyEsim = escapeHtml(myEsim);
  const html = `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#FFF7F2;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #f1e4dc;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;color:#e86a58;font-weight:700;">simplyur</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#12233F;">Refund complete</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5c6578;">Order <strong>${safeOrder}</strong> was cancelled because the eSIM was unused (not registered / no data used).</p>
    <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:#12233F;">
      <li>Card payment reversed with Eximbay</li>
      <li>Supplier eSIM profile cancelled</li>
    </ol>
    ${safeMyEsim ? `<p style="margin:0 0 12px;font-size:13px;color:#5c6578;"><a href="${safeMyEsim}" style="color:#e86a58;">Open My eSIM</a></p>` : ""}
    <p style="margin:0;font-size:12px;color:#8a93a3;">The refund may take a few days to appear on your card statement.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

export async function sendSimplyurRefundDoneMail(
  input: SimplyurRefundDoneMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, text, html } = buildSimplyurRefundDoneMailContent(input);
  return sendSimplyurMail({ to: input.to, subject, text, html });
}
