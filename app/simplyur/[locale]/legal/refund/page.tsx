import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimplyurLegalDocumentShell } from "@/components/simplyur/legal/SimplyurLegalDocumentShell";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { SimplyurRefundEnBody } from "@/lib/simplyur/legal-document-en";
import { simplyurLegalPath } from "@/lib/simplyur/legal-disclosures";

// REGRESSION-FREEZE[simplyur-pg-legal-surface]: simplyur 환불·서비스 정책 — manifest

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return {};
  const locale = raw as SimplyurLocale;
  return {
    title: "Refund Policy | simplyur",
    description: "simplyur eSIM refund, exchange, and service period policy.",
    alternates: { canonical: simplyurLegalPath(locale, "refund") },
  };
}

export default async function SimplyurRefundPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  return (
    <SimplyurLegalDocumentShell
      locale={locale}
      title="Refund & Service Policy"
      subtitle="Digital eSIM — service period, refunds, and notices."
    >
      <SimplyurRefundEnBody />
    </SimplyurLegalDocumentShell>
  );
}
