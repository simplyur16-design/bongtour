export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ko-KR").format(Math.trunc(amount)) + "원";
}
