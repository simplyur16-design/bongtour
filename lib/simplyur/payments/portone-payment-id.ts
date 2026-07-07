/** PortOne paymentId — stored in `bongsim_payment_attempt.provider_session_id`. */
export function buildSimplyurPortonePaymentId(orderNumber: string, paymentAttemptId: string): string {
  const attemptShort = paymentAttemptId.replace(/-/g, "").slice(0, 12);
  const safeOrder = orderNumber.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return `su-${safeOrder}-${attemptShort}`;
}
