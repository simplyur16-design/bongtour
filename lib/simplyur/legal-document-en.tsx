import Link from "next/link";
import { SIMPLYUR_LEGAL_ENTITY, simplyurLegalPath } from "@/lib/simplyur/legal-disclosures";
import type { SimplyurLocale } from "@/lib/simplyur/constants";

// REGRESSION-FREEZE[simplyur-pg-legal-surface]: simplyur legal copy — English default (foreign visitors)

function BizInfoListEn() {
  const e = SIMPLYUR_LEGAL_ENTITY;
  return (
    <ul className="ml-0 list-none space-y-1 pl-0 text-[15px]">
      <li>Company: Bong Tour Co., Ltd. ({e.legalName})</li>
      <li>Representative: {e.representativeName}</li>
      <li>Business registration no.: {e.bizRegNo}</li>
      <li>Mail-order sales report no.: {e.mailOrderReportNo}</li>
      <li>Tourism business registration: {e.tourismRegNo}</li>
      <li>Address: {e.address}</li>
      <li>
        Phone:{" "}
        <a href={e.phoneTel} className="underline underline-offset-2">
          {e.phone}
        </a>
      </li>
      <li>Fax: {e.fax}</li>
      <li>
        Email:{" "}
        <a href={e.emailHref} className="underline underline-offset-2">
          {e.email}
        </a>
      </li>
    </ul>
  );
}

export function SimplyurTermsEnBody({ locale }: { locale: SimplyurLocale }) {
  const e = SIMPLYUR_LEGAL_ENTITY;
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Article 1 (Purpose)</h2>
        <p>
          These Terms of Service govern the use of the {e.serviceName} service ({e.serviceDescription}) operated by Bong
          Tour Co., Ltd. ({e.legalName}, &quot;Company&quot;) and set forth the rights, obligations, and responsibilities
          between the Company and users.
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 2 (Definitions)</h2>
        <ol className="ml-4 list-decimal space-y-2 pl-1">
          <li>
            &quot;Service&quot; means Korea eSIM product information, ordering, payment, QR delivery, and customer
            support provided through the website and mobile app.
          </li>
          <li>&quot;User&quot; means any person who uses the Service under these Terms.</li>
          <li>
            &quot;eSIM&quot; means a digital SIM profile delivered as a QR code by email or similar means after payment.
            It is a non-physical digital product.
          </li>
        </ol>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 3 (Company information)</h2>
        <p>The Company displays the following information on the Service as required by applicable law.</p>
        <BizInfoListEn />
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 4 (Provision of the Service)</h2>
        <p>
          The Company displays plan details, price, validity period, and data allowance for the eSIM plans you select and
          sends a QR code after payment is completed. The Service is intended primarily for international visitors to
          Korea. The Company may change Service content with reasonable notice where required by law.
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 5 (User obligations)</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Provide accurate email, contact, and order information.</li>
          <li>Confirm eSIM device compatibility before purchase.</li>
          <li>Do not misuse the Service or use another person&apos;s information without authorization.</li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 6 (Payment, cancellation, and refunds)</h2>
        <p>
          Payments are processed through the payment gateway (PG) designated by the Company. eSIM is a digital product.
          Refunds and exchanges follow our{" "}
          <Link href={simplyurLegalPath(locale, "refund")} className="font-semibold underline underline-offset-2">
            Refund &amp; Service Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 7 (Limitation of liability)</h2>
        <p>
          The Company is not liable for issues caused by force majeure, carrier or device compatibility, or incorrect
          installation or activation by the user, except where applicable law requires otherwise.
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 8 (Governing law and disputes)</h2>
        <p>
          These Terms are governed by the laws of the Republic of Korea. Disputes shall be subject to the jurisdiction
          of the {e.jurisdictionCourtEn} unless mandatory consumer protection rules apply in your country of residence.
        </p>
        <p className="text-sm opacity-80">
          Effective: {e.policyEffectiveDateEn} · Last revised: {e.policyRevisedDateEn}
        </p>
      </section>
    </>
  );
}

export function SimplyurPrivacyEnBody({ locale }: { locale: SimplyurLocale }) {
  const e = SIMPLYUR_LEGAL_ENTITY;
  void locale;
  return (
    <>
      <p>
        Bong Tour Co., Ltd. ({e.legalName}, &quot;Company&quot;) operates {e.serviceName} ({e.serviceDescription}). This
        Privacy Policy explains how we collect, use, retain, and protect personal information in connection with the
        Service, in accordance with applicable laws including the Personal Information Protection Act of Korea.
      </p>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 1 (Information we collect)</h2>
        <p className="font-medium">1. Account sign-up and sign-in</p>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Email, password (stored encrypted), name (if provided)</li>
          <li>Social login identifiers (Google, Apple, etc., when used)</li>
        </ul>
        <p className="font-medium">2. eSIM order, payment, and delivery</p>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Buyer and recipient email and contact details</li>
          <li>Payment and transaction identifiers generated during PG processing</li>
          <li>Information needed for device compatibility, QR delivery, activation, and refunds</li>
        </ul>
        <p className="font-medium">3. Automatically collected during use</p>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>IP address, cookies, access time, usage logs, browser and device information</li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 2 (Purposes of processing)</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>User identification, authentication, and My eSIM access</li>
          <li>eSIM ordering, payment, QR delivery, and customer support</li>
          <li>Fraud prevention and service improvement</li>
          <li>Compliance with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 3 (Retention period)</h2>
        <p>
          We delete personal information without undue delay when the purpose is fulfilled. Where required by e-commerce
          or tax law, contract, payment, and dispute records may be retained for the statutory period.
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 4 (Third parties and processors)</h2>
        <p>
          We do not sell your personal information. We may use processors for payment, eSIM provisioning, email
          delivery, and hosting within the scope necessary to provide the Service, under contracts and oversight as
          required by law.
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 5 (Your rights)</h2>
        <p>
          You may request access, correction, deletion, or restriction of processing of your personal information by
          contacting{" "}
          <a href={e.emailHref} className="underline underline-offset-2">
            {e.email}
          </a>
          .
        </p>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Article 6 (Privacy contact)</h2>
        <BizInfoListEn />
        <p>
          Privacy inquiries:{" "}
          <a href={e.privacyOfficerEmail} className="underline underline-offset-2">
            {e.email}
          </a>
        </p>
        <p className="text-sm opacity-80">
          Effective: {e.policyEffectiveDateEn} · Last revised: {e.policyRevisedDateEn}
        </p>
        <p className="text-sm">
          Company-wide policy (travel and eSIM):{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            bongtour.com Privacy Policy
          </Link>
        </p>
      </section>
    </>
  );
}

export function SimplyurRefundEnBody() {
  const e = SIMPLYUR_LEGAL_ENTITY;
  return (
    <>
      <p>
        eSIM plans sold on {e.serviceName} are digital, non-physical products. This policy applies to Korea eSIM products
        sold by Bong Tour Co., Ltd. ({e.legalName}).
      </p>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Service period</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>A QR code is sent by email after payment is completed.</li>
          <li>
            Data validity depends on the plan purchased and starts from first activation (connection to a local network).
          </li>
          <li>Maximum unused validity: 180 days from the payment date if not activated.</li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Refund policy</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Unused QR (not activated): full refund available</li>
          <li>After activation: no refund</li>
          <li>Product defect: full refund or re-issue</li>
          <li>
            Refund requests:{" "}
            <a href={e.emailHref} className="underline underline-offset-2">
              {e.email}
            </a>{" "}
            or customer support at {e.phone}
          </li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Exchange policy</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Digital eSIM products cannot be exchanged.</li>
          <li>Defective products may be replaced with a re-issue of the same plan.</li>
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-bold">Important notices</h2>
        <ul className="ml-4 list-disc space-y-1 pl-1">
          <li>Users must confirm eSIM compatibility before purchase.</li>
          <li>Re-sending or re-issuing QR codes follows our operational policy.</li>
          <li>Network quality may vary by carrier, device, and local conditions.</li>
        </ul>
      </section>
    </>
  );
}
