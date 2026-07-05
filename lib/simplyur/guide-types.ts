/** simplyur eSIM install guide — message JSON shape (all locales). */

export type SimplyurGuideBlock = {
  heading?: string;
  paras?: string[];
  bullets?: string[];
  note?: string;
};

export type SimplyurGuideStep = {
  title: string;
  blocks: SimplyurGuideBlock[];
};

export type SimplyurGuideFaq = {
  q: string;
  a: string;
};

export type SimplyurGuideMessages = {
  title: string;
  intro: string;
  tabs: { precheck: string; iphone: string; android: string };
  stepsTitle: string;
  faqTitle: string;
  /** Short banner — what is live vs coming soon (matches SIMPLYUR_CHECKOUT_ENABLED / OAuth). */
  flowPhaseNote?: string;
  /** Optional — policies for future multi-region plans (not Phase 1 Korea-only). */
  regionalFaqTitle?: string;
  supportHint: string;
  precheckBlocks: SimplyurGuideBlock[];
  precheckFaq: SimplyurGuideFaq[];
  iphoneSteps: SimplyurGuideStep[];
  androidSteps: SimplyurGuideStep[];
  /** Core FAQ for visitors using Korea eSIM (Phase 1). */
  commonFaq: SimplyurGuideFaq[];
  /** Advance notices for plans outside current Korea-only catalog. */
  regionalFaq?: SimplyurGuideFaq[];
  regionalFaqNote?: string;
  quickSteps: string[];
};
