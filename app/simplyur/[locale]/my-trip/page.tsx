import { auth } from "@/auth";
import { SimplyurMyTripClient } from "@/components/simplyur/SimplyurMyTripClient";
import { notFound, redirect } from "next/navigation";
import { isSimplyurLocale, simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";

type Props = { params: Promise<{ locale: string }> };

/** My Trip — paste confirmation emails → timeline (Trip Inbox MVP) */
// REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: my-trip auth gate — manifest
export default async function SimplyurMyTripPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  const session = await auth();
  const email = session?.user?.email?.trim() ?? "";
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  const myTripPath = simplyurPath(locale, "/my-trip");

  if (!email && !userId) {
    redirect(`${simplyurPath(locale, "/sign-in")}?callbackUrl=${encodeURIComponent(myTripPath)}`);
  }

  return <SimplyurMyTripClient />;
}
