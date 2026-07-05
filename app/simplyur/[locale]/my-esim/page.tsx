import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SimplyurMyEsimClient } from "@/components/simplyur/SimplyurMyEsimClient";
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";

type Props = { params: Promise<{ locale: string }> };

export default async function SimplyurMyEsimPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return null;
  const locale = raw as SimplyurLocale;

  const session = await auth();
  const myEsimPath = simplyurPath(locale, "/my-esim");

  if (!session?.user) {
    redirect(`${simplyurPath(locale, "/sign-in")}?callbackUrl=${encodeURIComponent(myEsimPath)}`);
  }

  return <SimplyurMyEsimClient />;
}
