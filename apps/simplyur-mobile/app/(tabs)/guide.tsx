import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyIcon } from '@/src/components/ui/SyIcon';
import { ESIM_MARK_ON_DARK, Segmented } from '@/src/components/ui/SyUi';
import { GUIDE_DESIGN as D } from '@/src/constants/guide-design';
import { SY, SY_RADIUS } from '@/src/constants/theme';
import { getSimplyurGuideMessages } from '@/src/guide/by-locale';
import type { SimplyurGuideMockRow, SimplyurGuidePrecheckCard, SimplyurGuideStepCard } from '@/src/guide/guide-types';
import {
  guideAndroidStepCards,
  guideFaqItems,
  guideIphoneStepCards,
  guidePhaseBanner,
  guidePrecheckCards,
} from '@/src/guide/view-model';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

type TabKey = 'precheck' | 'iphone' | 'android';

/**
 * design_handoff_guide — Install guide (Expo iOS + Android)
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: no system browser — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: devices native screen — manifest
 */
export default function GuideScreen() {
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const guide = getSimplyurGuideMessages(locale);
  const [tab, setTab] = useState<TabKey>('precheck');
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set());

  const phaseBanner = guidePhaseBanner(guide);
  const precheck = guidePrecheckCards(guide);
  const iphoneSteps = guideIphoneStepCards(guide);
  const androidSteps = guideAndroidStepCards(guide);
  const faqs = guideFaqItems(guide);
  const stepCards = tab === 'iphone' ? iphoneSteps : androidSteps;
  const devicesLabel = guide.devicesLinkLabel ?? 'Compatible devices';

  function openDevices() {
    router.push('/devices');
  }

  function toggleFaq(index: number) {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'precheck', label: guide.tabs.precheck },
    { key: 'iphone', label: guide.tabs.iphone },
    { key: 'android', label: guide.tabs.android },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: D.paddingH,
        gap: D.sectionGap,
      }}>
      <View style={styles.header}>
        <Text style={styles.title}>{guide.title}</Text>
      </View>

      {/* 1.0.2 mockup 05: ink card — the 1-tap install lives on each eSIM in My eSIM (real order data). */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>{t('guideHero.eyebrow')}</Text>
            <Text style={styles.heroTitle}>{t('guideHero.title')}</Text>
          </View>
          <Image source={ESIM_MARK_ON_DARK} style={styles.heroMark} resizeMode="contain" accessible={false} />
        </View>
        <Pressable
          style={styles.heroBtn}
          onPress={() => router.push('/my-esim')}
          accessibilityRole="button">
          <Text style={styles.heroBtnText}>{t('guideHero.cta')}</Text>
        </Pressable>
        <Text style={styles.heroNote}>{t('guideHero.note')}</Text>
      </View>

      <Segmented items={tabs} value={tab} onChange={setTab} />

      <Text style={styles.intro}>{tab === 'precheck' ? guide.intro : t('guideHero.tapHint')}</Text>

      {phaseBanner && tab === 'precheck' ? (
        <View style={styles.banner}>
          <SyIcon name="info" size={16} color={SY.primary} strokeWidth={2} />
          <Text style={styles.bannerBody}>{phaseBanner}</Text>
        </View>
      ) : null}

      <View style={styles.tabContent}>
        {tab === 'precheck'
          ? precheck.map((card) => (
              <PrecheckCard key={card.title} card={card} devicesLabel={devicesLabel} onDevices={openDevices} />
            ))
          : stepCards.map((step, i) => (
              <StepCard key={step.title} step={step} n={i + 1} label={t('guideHero.step')} />
            ))}
      </View>

      <Text style={styles.support}>{guide.supportHint}</Text>

      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>{guide.faqTitle}</Text>
        {faqs.map(({ q, a }, index) => {
          const open = openFaqs.has(index);
          return (
            <View key={q} style={styles.faqCard}>
              <Pressable onPress={() => toggleFaq(index)} style={styles.faqHead}>
                <Text style={styles.faqQ}>{q}</Text>
                <View style={open ? styles.faqChevronOpen : styles.faqChevron}>
                  <SyIcon name="chev" size={16} color={SY.ink3} strokeWidth={2} />
                </View>
              </Pressable>
              {open ? <Text style={styles.faqA}>{a}</Text> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function NoteCallout({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <SyIcon name="info" size={14} color={SY.primary} strokeWidth={2} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function SettingsMockup({ rows }: { rows: SimplyurGuideMockRow[] }) {
  return (
    <View style={styles.mock}>
      {rows.map((row) => (
        <View key={`${row.label}-${row.value}`} style={[styles.mockRow, row.highlight && styles.mockRowHi]}>
          <Text style={styles.mockLabel}>{row.label}</Text>
          <Text style={styles.mockValue}>
            {row.value} <Text style={styles.mockChevron}>›</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <Text key={item} style={styles.bullet}>
          – {item}
        </Text>
      ))}
    </>
  );
}

function PrecheckCard({
  card,
  devicesLabel,
  onDevices,
}: {
  card: SimplyurGuidePrecheckCard;
  devicesLabel: string;
  onDevices: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{card.title}</Text>
      {card.body ? <Text style={styles.cardBody}>{card.body}</Text> : null}
      {card.bullets?.length ? <BulletList items={card.bullets} /> : null}
      {card.linkLabel ? (
        <Pressable onPress={onDevices}>
          <Text style={styles.link}>{devicesLabel} →</Text>
        </Pressable>
      ) : null}
      {card.note ? <NoteCallout text={card.note} /> : null}
    </View>
  );
}

function StepCard({ step, n, label }: { step: SimplyurGuideStepCard; n: number; label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.stepEyebrow}>{label.replace('{n}', String(n))}</Text>
      <Text style={styles.stepTitle}>{step.title.replace(/^\s*\d+[.)]\s*/, '')}</Text>
      {step.mockRows?.length ? <SettingsMockup rows={step.mockRows} /> : null}
      {step.bullets?.length ? <BulletList items={step.bullets} /> : null}
      {step.note ? <NoteCallout text={step.note} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 24, ...fp('700'), color: D.navy, letterSpacing: -0.3 },
  intro: { fontSize: 13.5, lineHeight: 20, ...fp('400'), color: D.muted },
  support: { fontSize: 12.5, lineHeight: 18, ...fp('400'), color: D.faint, textAlign: 'center' },
  hero: { backgroundColor: SY.ink, borderRadius: SY_RADIUS.hero, padding: 20, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroText: { flex: 1, gap: 4 },
  heroEyebrow: { fontSize: 12, ...fp('600'), color: SY.primaryOnDark, letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 18, lineHeight: 23, ...fp('700'), color: '#fff' },
  heroMark: { width: 48, height: 36 },
  heroBtn: {
    height: 54,
    borderRadius: SY_RADIUS.button,
    backgroundColor: SY.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroBtnText: { fontSize: 16, ...fp('700'), color: '#fff' },
  heroNote: { fontSize: 12.5, ...fp('400'), color: SY.onInkMuted, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: SY.primaryTint,
    borderWidth: 1,
    borderColor: SY.primaryTintBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerBody: { flex: 1, fontSize: 12.5, lineHeight: 18, ...fp('400'), color: D.muted },
  tabContent: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    padding: D.cardPadding,
    gap: 8,
  },
  cardTitle: { fontSize: 15, ...fp('700'), color: D.navy },
  stepEyebrow: { fontSize: 12, ...fp('700'), color: SY.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  stepTitle: { fontSize: 17, lineHeight: 22, ...fp('700'), color: D.navy },
  cardBody: { fontSize: 14, lineHeight: 22, ...fp('400'), color: D.muted },
  bullet: { fontSize: 14, lineHeight: 22, ...fp('400'), color: D.muted, paddingLeft: 2 },
  link: { fontSize: 13, ...fp('600'), color: D.coral, marginTop: 2 },
  note: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: D.bannerBg,
    borderWidth: 1,
    borderColor: D.bannerBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 19, ...fp('400'), color: D.navy },
  mock: {
    backgroundColor: D.mockBg,
    borderWidth: 1,
    borderColor: D.mockBorder,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  mockRowHi: { backgroundColor: SY.surface, borderColor: SY.danger },
  mockLabel: { fontSize: 12.5, ...fp('600'), color: D.navy },
  mockValue: { fontSize: 12, ...fp('400'), color: D.faint },
  mockChevron: { color: D.mockChevron },
  faqSection: { gap: 12, marginTop: 6 },
  faqTitle: { fontSize: 18, ...fp('800'), color: D.navy },
  faqCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.faqRadius,
    overflow: 'hidden',
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  faqQ: { flex: 1, fontSize: 14, ...fp('700'), color: D.navy, lineHeight: 20 },
  faqChevron: { transform: [{ rotate: '90deg' }] },
  faqChevronOpen: { transform: [{ rotate: '-90deg' }] },
  faqA: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    fontSize: 13,
    lineHeight: 21,
    ...fp('400'),
    color: D.muted,
  },
});
