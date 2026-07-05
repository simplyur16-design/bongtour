import { SimplyurAuthErrorClient } from "@/components/simplyur/auth/SimplyurAuthErrorClient";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";

type Props = { params: Promise<{ locale: string }> };

export default async function SimplyurAuthErrorPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return null;
  return <SimplyurAuthErrorClient locale={raw as SimplyurLocale} />;
}
