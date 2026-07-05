import { redirect } from "next/navigation";
import { SIMPLYUR_DEFAULT_LOCALE, simplyurPath } from "@/lib/simplyur/constants";

export default function SimplyurRootPage() {
  redirect(simplyurPath(SIMPLYUR_DEFAULT_LOCALE));
}
