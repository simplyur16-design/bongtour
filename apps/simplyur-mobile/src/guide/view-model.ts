import type {
  SimplyurGuideMessages,
  SimplyurGuidePrecheckCard,
  SimplyurGuideStepCard,
  SimplyurGuideFaq,
  SimplyurGuideStep,
} from '@/src/guide/guide-types';

function blocksToStepCards(steps: SimplyurGuideStep[]): SimplyurGuideStepCard[] {
  return steps.map((step, idx) => {
    const bullets: string[] = [];
    let note: string | undefined;
    for (const block of step.blocks) {
      if (block.bullets) bullets.push(...block.bullets);
      if (block.note) note = block.note;
      if (block.paras) bullets.push(...block.paras);
    }
    return {
      title: step.title.match(/^\d+\./) ? step.title : `${idx + 1}. ${step.title}`,
      bullets: bullets.length > 0 ? bullets : undefined,
      note,
    };
  });
}

export function guidePrecheckCards(guide: SimplyurGuideMessages): SimplyurGuidePrecheckCard[] {
  if (guide.precheckCards?.length) return guide.precheckCards;
  return guide.precheckBlocks.map((block) => ({
    title: block.heading ?? '',
    body: block.paras?.[0],
    bullets: block.bullets,
    linkLabel: block.linkLabel,
    note: block.note,
  }));
}

export function guideIphoneStepCards(guide: SimplyurGuideMessages): SimplyurGuideStepCard[] {
  if (guide.iphoneStepCards?.length) return guide.iphoneStepCards;
  return blocksToStepCards(guide.iphoneSteps);
}

export function guideAndroidStepCards(guide: SimplyurGuideMessages): SimplyurGuideStepCard[] {
  if (guide.androidStepCards?.length) return guide.androidStepCards;
  return blocksToStepCards(guide.androidSteps);
}

export function guideFaqItems(guide: SimplyurGuideMessages): SimplyurGuideFaq[] {
  if (guide.faqItems?.length) return guide.faqItems;
  return [...guide.precheckFaq, ...guide.commonFaq];
}

export function guidePhaseBanner(guide: SimplyurGuideMessages): string | null {
  return guide.phaseBanner ?? guide.flowPhaseNote ?? null;
}
