import { headers } from "next/headers";
import HomePageLoading from "@/components/route-loading/HomePageLoading";
import SimplyurPageLoading from "@/components/route-loading/SimplyurPageLoading";
import {
  SIMPLYUR_SURFACE_HEADER,
  SIMPLYUR_SURFACE_VALUE,
} from "@/lib/surface/simplyur-surface";

export default async function Loading() {
  const hdrs = await headers();
  if (hdrs.get(SIMPLYUR_SURFACE_HEADER) === SIMPLYUR_SURFACE_VALUE) {
    return <SimplyurPageLoading />;
  }
  return <HomePageLoading />;
}
