"use client";

import type { SimplyurGuideMessages } from "@/lib/simplyur/guide-types";
import { SimplyurGuidePanel } from "@/components/simplyur/guide/SimplyurGuidePanel";

type Props = {
  guide: SimplyurGuideMessages;
};

/** @deprecated use SimplyurGuidePanel — kept for page import path */
export function SimplyurGuideClient({ guide }: Props) {
  return <SimplyurGuidePanel guide={guide} />;
}
