import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimplyurLegalDocumentShell } from "@/components/simplyur/legal/SimplyurLegalDocumentShell";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { SimplyurAccountDeletionEnBody } from "@/lib/simplyur/legal-document-en";
import { simplyurLegalPath } from "@/lib/simplyur/legal-disclosures";

// REGRESSION-FREEZE[simplyur-play-account-deletion-url]: Play Console 계정 삭제 URL — manifest

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return {};
  const locale = raw as SimplyurLocale;
  return {
    title: "Delete account | simplyur",
    description: "Request deletion of your simplyur account and associated personal data.",
    alternates: { canonical: simplyurLegalPath(locale, "account-deletion") },
  };
}

export default async function SimplyurAccountDeletionPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  return (
    <SimplyurLegalDocumentShell
      locale={locale}
      title="Delete your simplyur account"
      subtitle="Request deletion of your account and related personal data. You do not need the app to send this request."
    >
      <SimplyurAccountDeletionEnBody />
    </SimplyurLegalDocumentShell>
  );
}
