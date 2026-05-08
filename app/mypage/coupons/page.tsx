import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CouponsClient from "@/components/mypage/CouponsClient";

export const dynamic = "force-dynamic";

export default async function MyPageCouponsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/mypage/coupons");
  }
  return <CouponsClient />;
}
