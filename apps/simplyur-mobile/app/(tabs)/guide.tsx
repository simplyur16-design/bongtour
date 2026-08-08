import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUIDE_DESIGN as D } from '@/src/constants/guide-design';
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
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: devices in-app WebView — manifest
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
    router.push({
      pathname: '/in-app-web',
      params: { path: 'devices', title: t('hero.deviceLink') },
    });
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
        <Text style={styles.intro}>{guide.intro}</Text>
        <Text style={styles.support}>{guide.supportHint}</Text>
      </View>

      {phaseBanner ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerIconText}>i</Text>
          </View>
          <Text style={styles.bannerBody}>{phaseBanner}</Text>
        </View>
      ) : null}

      <View style={styles.segmentRow}>
        {tabs.map(({ key, label }) => {
          const selected = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segment, selected ? styles.segmentOn : styles.segmentOff]}>
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : styles.segmentTextOff]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tabContent}>
        {tab === 'precheck'
          ? precheck.map((card) => (
              <PrecheckCard key={card.title} card={card} devicesLabel={devicesLabel} onDevices={openDevices} />
            ))
          : stepCards.map((step) => <StepCard key={step.title} step={step} />)}
      </View>

      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>{guide.faqTitle}</Text>
        {faqs.map(({ q, a }, index) => {
          const open = openFaqs.has(index);
          return (
            <View key={q} style={styles.faqCard}>
              <Pressable onPress={() => toggleFaq(index)} style={styles.faqHead}>
                <Text style={styles.faqQ}>{q}</Text>
                <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>⌄</Text>
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
      <Text style={styles.noteEmoji}>💡</Text>
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

function StepCard({ step }: { step: SimplyurGuideStepCard }) {
  return (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>{step.title}</Text>
      {step.mockRows?.length ? <SettingsMockup rows={step.mockRows} /> : null}
      {step.bullets?.length ? <BulletList items={step.bullets} /> : null}
      {step.note ? <NoteCallout text={step.note} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 10 },
  title: { fontSize: 26, ...fp('800'), color: D.navy, letterSpacing: -0.3 },
  intro: { fontSize: 14, lineHeight: 21, ...fp('400'), color: D.muted },
  support: { fontSize: 12, lineHeight: 18, ...fp('400'), color: D.faint },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: D.bannerBg,
    borderWidth: 1,
    borderColor: D.bannerBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconText: { color: '#fff', fontSize: 12, ...fp('700') },
  bannerBody: { flex: 1, fontSize: 12, lineHeight: 18, ...fp('400'), color: D.muted },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    height: D.segmentHeight,
    borderRadius: D.segmentRadius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  segmentOn: { backgroundColor: D.coral, borderColor: D.coral },
  segmentOff: { backgroundColor: 'transparent', borderColor: D.border },
  segmentText: { fontSize: 14, ...fp('600') },
  segmentTextOn: { color: '#fff' },
  segmentTextOff: { color: D.faint },
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
  stepTitle: { fontSize: 16, ...fp('700'), color: D.navy },
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
  noteEmoji: { fontSize: 13 },
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
  mockRowHi: { backgroundColor: D.bg, borderColor: D.coral },
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
  faqChevron: { fontSize: 13, color: D.faint },
  faqChevronOpen: { transform: [{ rotate: '180deg' }] },
  faqA: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    fontSize: 13,
    lineHeight: 21,
    ...fp('400'),
    color: D.muted,
  },
});
