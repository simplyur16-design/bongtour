import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PressVerificationClient from "@/components/mypage/PressVerificationClient";

export const dynamic = "force-dynamic";

export default async function MyPagePressVerificationPage() {
  const session = await auth();
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!userId) {
    redirect("/auth/signin?callbackUrl=/mypage/press");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pressVerified: true,
      pressVerifiedAt: true,
      pressVerifiedDomain: true,
      pressVerifiedEmail: true,
      marketingConsent: true,
    },
  });

  if (!user) {
    redirect("/auth/signin?callbackUrl=/mypage/press");
  }

  return (
    <PressVerificationClient
      initial={{
        pressVerified: user.pressVerified,
        pressVerifiedAt: user.pressVerifiedAt?.toISOString() ?? null,
        pressVerifiedDomain: user.pressVerifiedDomain,
        pressVerifiedEmail: user.pressVerifiedEmail,
        marketingConsent: user.marketingConsent,
      }}
    />
  );
}
