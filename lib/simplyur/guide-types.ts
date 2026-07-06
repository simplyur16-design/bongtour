/** simplyur eSIM install guide — message JSON shape (all locales). */

export type SimplyurGuideBlock = {
  heading?: string;
  paras?: string[];
  bullets?: string[];
  note?: string;
  linkLabel?: string;
};

export type SimplyurGuideStep = {
  title: string;
  blocks: SimplyurGuideBlock[];
};

export type SimplyurGuideMockRow = {
  label: string;
  value: string;
  highlight?: boolean;
};

export type SimplyurGuidePrecheckCard = {
  title: string;
  body?: string;
  bullets?: string[];
  linkLabel?: string;
  note?: string;
};

export type SimplyurGuideStepCard = {
  title: string;
  bullets?: string[];
  mockRows?: SimplyurGuideMockRow[];
  note?: string;
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
  /** design_handoff_guide — compact phase banner copy */
  phaseBanner?: string;
  devicesLinkLabel?: string;
  /** Optional — policies for future multi-region plans (not Phase 1 Korea-only). */
  regionalFaqTitle?: string;
  supportHint: string;
  /** Legacy block layout — used when precheckCards absent */
  precheckBlocks: SimplyurGuideBlock[];
  precheckFaq: SimplyurGuideFaq[];
  iphoneSteps: SimplyurGuideStep[];
  androidSteps: SimplyurGuideStep[];
  /** design_handoff_guide — card layout (preferred when present) */
  precheckCards?: SimplyurGuidePrecheckCard[];
  iphoneStepCards?: SimplyurGuideStepCard[];
  androidStepCards?: SimplyurGuideStepCard[];
  /** Unified FAQ list — preferred over precheckFaq + commonFaq when present */
  faqItems?: SimplyurGuideFaq[];
  /** Core FAQ for visitors using Korea eSIM (Phase 1). */
  commonFaq: SimplyurGuideFaq[];
  /** Advance notices for plans outside current Korea-only catalog. */
  regionalFaq?: SimplyurGuideFaq[];
  regionalFaqNote?: string;
  quickSteps: string[];
};
