import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import CouponsAdminClient from "./CouponsAdminClient";

export default async function AdminBongsimCouponsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/auth/signin?callbackUrl=/admin/bongsim/coupons");

  return (
    <div className="mx-auto max-w-5xl pb-16 text-slate-100">
      <CouponsAdminClient />
    </div>
  );
}
