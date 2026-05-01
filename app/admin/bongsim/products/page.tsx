import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import BongsimProductsAdminClient from "./BongsimProductsAdminClient";

export default async function AdminBongsimProductsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/auth/signin?callbackUrl=/admin/bongsim/products");

  return (
    <div className="mx-auto max-w-7xl pb-16 text-slate-100">
      <BongsimProductsAdminClient />
    </div>
  );
}
