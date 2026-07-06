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
  flowPhaseNote?: string;
  phaseBanner?: string;
  devicesLinkLabel?: string;
  regionalFaqTitle?: string;
  supportHint: string;
  precheckBlocks: SimplyurGuideBlock[];
  precheckFaq: SimplyurGuideFaq[];
  iphoneSteps: SimplyurGuideStep[];
  androidSteps: SimplyurGuideStep[];
  precheckCards?: SimplyurGuidePrecheckCard[];
  iphoneStepCards?: SimplyurGuideStepCard[];
  androidStepCards?: SimplyurGuideStepCard[];
  faqItems?: SimplyurGuideFaq[];
  commonFaq: SimplyurGuideFaq[];
  regionalFaq?: SimplyurGuideFaq[];
  regionalFaqNote?: string;
  quickSteps: string[];
};
