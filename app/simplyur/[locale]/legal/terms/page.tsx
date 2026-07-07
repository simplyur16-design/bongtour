import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimplyurLegalDocumentShell } from "@/components/simplyur/legal/SimplyurLegalDocumentShell";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { SimplyurTermsEnBody } from "@/lib/simplyur/legal-document-en";
import { simplyurLegalPath } from "@/lib/simplyur/legal-disclosures";

// REGRESSION-FREEZE[simplyur-pg-legal-surface]: simplyur 이용약관 — manifest

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return {};
  const locale = raw as SimplyurLocale;
  return {
    title: "Terms of Service | simplyur",
    description: "simplyur Korea eSIM service terms of use.",
    alternates: { canonical: simplyurLegalPath(locale, "terms") },
  };
}

export default async function SimplyurTermsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  return (
    <SimplyurLegalDocumentShell
      locale={locale}
      title="Terms of Service"
      subtitle="simplyur Korea eSIM for international visitors — operated by Bong Tour Co., Ltd."
    >
      <SimplyurTermsEnBody locale={locale} />
    </SimplyurLegalDocumentShell>
  );
}
