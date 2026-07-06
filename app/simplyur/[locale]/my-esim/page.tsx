import { SimplyurMyEsimClient } from "@/components/simplyur/SimplyurMyEsimClient";

type Props = { params: Promise<{ locale: string }> };

/** design_handoff_my_esim — My eSIM (sign-in gate in client UI) */
export default async function SimplyurMyEsimPage(_props: Props) {
  return <SimplyurMyEsimClient />;
}
