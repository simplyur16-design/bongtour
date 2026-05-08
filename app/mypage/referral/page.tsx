import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ReferralClient from "@/components/mypage/ReferralClient";

export const dynamic = "force-dynamic";

export default async function MyPageReferralPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/mypage/referral");
  }
  return <ReferralClient />;
}
