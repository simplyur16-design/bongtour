import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getSimplyurGuideMessages } from '@/src/guide/by-locale';
import type { SimplyurGuideBlock, SimplyurGuideStep } from '@/src/guide/guide-types';
import { useI18n } from '@/src/i18n/I18nContext';

type TabKey = 'precheck' | 'iphone' | 'android';

function BlockView({ block, muted }: { block: SimplyurGuideBlock; muted: string }) {
  return (
    <View style={styles.block}>
      {block.heading ? <Text style={styles.blockHeading}>{block.heading}</Text> : null}
      {block.paras?.map((p) => (
        <Text key={p} style={[styles.para, { color: muted }]}>
          {p}
        </Text>
      ))}
      {block.bullets?.map((b) => (
        <Text key={b} style={[styles.bullet, { color: muted }]}>
          • {b}
        </Text>
      ))}
      {block.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{block.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StepsView({ steps, muted }: { steps: SimplyurGuideStep[]; muted: string }) {
  return (
    <>
      {steps.map((step, idx) => (
        <View key={step.title} style={styles.stepSection}>
          <Text style={styles.stepTitle}>
            {idx + 1}. {step.title}
          </Text>
          {step.blocks.map((block, i) => (
            <BlockView key={`${step.title}-${i}`} block={block} muted={muted} />
          ))}
        </View>
      ))}
    </>
  );
}

export default function GuideScreen() {
  const { locale } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const guide = getSimplyurGuideMessages(locale);
  const [tab, setTab] = useState<TabKey>('precheck');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'precheck', label: guide.tabs.precheck },
    { key: 'iphone', label: guide.tabs.iphone },
    { key: 'android', label: guide.tabs.android },
  ];

  const mainFaqs = [...guide.precheckFaq, ...guide.commonFaq];

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{guide.title}</Text>
      <Text style={[styles.intro, { color: colors.inkMuted }]}>{guide.intro}</Text>
      {guide.flowPhaseNote ? (
        <View style={[styles.phaseNote, { backgroundColor: colors.celadonLight, borderColor: colors.hanjiBorder }]}>
          <Text style={[styles.phaseNoteText, { color: colors.celadonDark }]}>{guide.flowPhaseNote}</Text>
        </View>
      ) : null}
      <Text style={[styles.support, { color: colors.inkMuted }]}>{guide.supportHint}</Text>

      <View style={styles.tabRow}>
        {tabs.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.celadon }
                  : { backgroundColor: '#fff', borderColor: colors.hanjiBorder, borderWidth: 1 },
              ]}>
              <Text style={[styles.tabText, { color: active ? '#fff' : colors.inkMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'precheck'
        ? guide.precheckBlocks.map((block, i) => (
            <View key={i} style={[styles.card, { borderColor: colors.hanjiBorder }]}>
              <BlockView block={block} muted={colors.inkMuted} />
            </View>
          ))
        : null}
      {tab === 'iphone' ? <StepsView steps={guide.iphoneSteps} muted={colors.inkMuted} /> : null}
      {tab === 'android' ? <StepsView steps={guide.androidSteps} muted={colors.inkMuted} /> : null}

      <Text style={[styles.faqTitle, { color: colors.text }]}>{guide.faqTitle}</Text>
      {mainFaqs.map(({ q, a }) => {
        const open = openFaq === q;
        return (
          <View key={q} style={[styles.faqCard, { borderColor: colors.hanjiBorder }]}>
            <Pressable onPress={() => setOpenFaq(open ? null : q)} style={styles.faqHead}>
              <Text style={[styles.faqQ, { color: colors.text }]}>{q}</Text>
            </Pressable>
            {open ? <Text style={[styles.faqA, { color: colors.inkMuted }]}>{a}</Text> : null}
          </View>
        );
      })}

      {guide.regionalFaq && guide.regionalFaq.length > 0 ? (
        <>
          <Text style={[styles.faqTitle, { color: colors.text, marginTop: 28 }]}>
            {guide.regionalFaqTitle ?? 'Regional notices'}
          </Text>
          {guide.regionalFaqNote ? (
            <Text style={[styles.regionalNote, { color: colors.inkMuted }]}>{guide.regionalFaqNote}</Text>
          ) : null}
          {guide.regionalFaq.map(({ q, a }) => {
            const open = openFaq === q;
            return (
              <View key={q} style={[styles.faqCard, { borderColor: colors.hanjiBorder }]}>
                <Pressable onPress={() => setOpenFaq(open ? null : q)} style={styles.faqHead}>
                  <Text style={[styles.faqQ, { color: colors.text }]}>{q}</Text>
                </Pressable>
                {open ? <Text style={[styles.faqA, { color: colors.inkMuted }]}>{a}</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800' },
  intro: { marginTop: 10, fontSize: 14, lineHeight: 21 },
  phaseNote: { marginTop: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  phaseNoteText: { fontSize: 13, lineHeight: 19 },
  support: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '700' },
  card: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  block: { gap: 6 },
  blockHeading: { fontSize: 15, fontWeight: '700', color: '#0b1b44' },
  para: { fontSize: 14, lineHeight: 21 },
  bullet: { fontSize: 14, lineHeight: 21, paddingLeft: 4 },
  noteBox: {
    marginTop: 4,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noteText: { fontSize: 13, lineHeight: 19, color: '#78350f' },
  stepSection: { marginTop: 16 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#0b1b44', marginBottom: 8 },
  faqTitle: { marginTop: 28, fontSize: 18, fontWeight: '800' },
  regionalNote: { marginTop: 8, marginBottom: 4, fontSize: 13, lineHeight: 19 },
  faqCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqHead: { padding: 14 },
  faqQ: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  faqA: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 13, lineHeight: 20 },
});
