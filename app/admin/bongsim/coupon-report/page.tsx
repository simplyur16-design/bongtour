import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import CouponReportClient from "./CouponReportClient";

export default async function AdminBongsimCouponReportPage() {
  const session = await requireAdmin();
  if (!session) redirect("/auth/signin?callbackUrl=/admin/bongsim/coupon-report");

  return (
    <div className="mx-auto max-w-6xl pb-16 text-slate-100">
      <CouponReportClient />
    </div>
  );
}
