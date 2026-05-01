import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import BongsimPaymentsAdminClient from "./BongsimPaymentsAdminClient";

export default async function AdminBongsimPaymentsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/auth/signin?callbackUrl=/admin/bongsim/payments");

  return (
    <div className="mx-auto max-w-6xl pb-16 text-slate-100">
      <BongsimPaymentsAdminClient />
    </div>
  );
}
