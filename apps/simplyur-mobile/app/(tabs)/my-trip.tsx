import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  correctTripSegment,
  parseTripInboxText,
  type TripParsedSegment,
  type TripParseStatus,
} from '@/src/api/trip-inbox';
import { SocialAuthButtons } from '@/src/components/auth/SocialAuthButtons';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { LOGIN_1B as D } from '@/src/constants/login-design';
import { SIMPLYUR_PALETTE as P } from '@/src/constants/palette';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  loadTripInboxSegments,
  mergeTripInboxSegments,
  saveTripInboxSegments,
} from '@/src/lib/trip-inbox-store';
import {
  hydrateTripSources,
  loadTripFormParsers,
  recallTripSource,
  rememberTripSource,
  saveTripFormParser,
} from '@/src/lib/trip-inbox-learn-store';
import { pickTripConfirmationFile } from '@/src/lib/pick-trip-confirmation';
import {
  hotelDisplayNames,
  pickCurrentHotelStay,
  pickUpcomingHotelStay,
} from '@/src/lib/current-hotel-stay';
import { getSimplyurAccessToken, subscribeSimplyurSession } from '@/src/lib/session';

/**
 * My Trip — paste confirmations → timeline (Trip Inbox MVP).
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile my-trip native — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: native paste UI, not web chrome — manifest
 * REGRESSION-FREEZE[simplyur-my-trip-fontsize]: fp() is fontFamily, never fontSize — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: upload + always-on correction — manifest
 */
export default function MyTripScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [segments, setSegments] = useState<TripParsedSegment[]>([]);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<TripParsedSegment | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const refreshAuth = useCallback(async () => {
    const token = await getSimplyurAccessToken();
    setSignedIn(Boolean(token));
  }, []);

  const reload = useCallback(async () => {
    await refreshAuth();
    await hydrateTripSources();
    setSegments(await loadTripInboxSegments());
  }, [refreshAuth]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return subscribeSimplyurSession(() => {
        void reload();
      });
    }, [reload]),
  );

  const persist = useCallback(async (next: TripParsedSegment[]) => {
    setSegments(next);
    await saveTripInboxSegments(next);
  }, []);

  const ingest = useCallback(
    async (text: string, pdfBase64?: string) => {
      setBusy(true);
      setError(null);
      try {
        const formParsers = await loadTripFormParsers();
        const res = await parseTripInboxText(text, { pdfBase64, formParsers });
        if (!res.ok) {
          setError(res.unauthorized ? t('myTrip.signInRequired') : t('myTrip.parseError'));
          if (res.unauthorized) setSignedIn(false);
          return;
        }
        const existing = await loadTripInboxSegments();
        const merged = mergeTripInboxSegments(existing, res.result.segments);
        await persist(merged);
        const source = (res.result.source_text || text).trim();
        for (const s of res.result.segments) {
          if (source) rememberTripSource(s.temp_id, source);
        }
        await saveTripFormParser(res.result.form_parser);
        setPaste('');
      } catch {
        setError(t('myTrip.parseError'));
      } finally {
        setBusy(false);
      }
    },
    [persist, t],
  );

  const onParse = useCallback(async () => {
    await ingest(paste);
  }, [ingest, paste]);

  const onUpload = useCallback(async () => {
    const picked = await pickTripConfirmationFile();
    if (!picked) return;
    await ingest(picked.text ?? '', picked.pdfBase64);
  }, [ingest]);

  const openEdit = useCallback((seg: TripParsedSegment) => {
    setEditing(seg);
    const p = seg.payload;
    if (p.type === 'flight') {
      setDraft({
        flight_no: String(p.flight_no ?? ''),
        airline: String(p.airline ?? ''),
        dep_airport: String(p.dep_airport ?? ''),
        arr_airport: String(p.arr_airport ?? ''),
        dep_at: String(p.dep_at ?? ''),
        arr_at: String(p.arr_at ?? ''),
        pnr: String(p.pnr ?? ''),
      });
    } else if (p.type === 'hotel') {
      setDraft({
        property_name: String(p.property_name ?? ''),
        property_name_user: String(p.property_name_user ?? ''),
        property_name_dest: String(p.property_name_dest ?? ''),
        address_user: String(p.address_user ?? ''),
        address_dest: String(p.address_dest ?? ''),
        check_in_at: String(p.check_in_at ?? ''),
        check_out_at: String(p.check_out_at ?? ''),
        booking_ref: String(p.booking_ref ?? ''),
        dest_lang: String(p.dest_lang ?? 'ko'),
      });
    } else if (p.type === 'experience') {
      setDraft({
        title: String(p.title ?? ''),
        venue: String(p.venue ?? ''),
        start_at: String(p.start_at ?? ''),
        booking_ref: String(p.booking_ref ?? ''),
      });
    } else {
      setDraft({
        pickup_location: String(p.pickup_location ?? ''),
        pickup_at: String(p.pickup_at ?? ''),
        vehicle_class: String(p.vehicle_class ?? ''),
      });
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(draft)) payload[k] = v.trim() || null;
      const formParsers = await loadTripFormParsers();
      const existingParser =
        formParsers.find((p) => p.form_id === editing.form_id || p.fingerprint === editing.source_fingerprint) ?? null;
      const res = await correctTripSegment(editing, payload, {
        sourceText: recallTripSource(editing.temp_id),
        formParser: existingParser,
      });
      if (!res.ok) {
        setError(res.unauthorized ? t('myTrip.signInRequired') : t('myTrip.correctError'));
        return;
      }
      await saveTripFormParser(res.form_parser);
      const existing = (await loadTripInboxSegments()).filter((s) => s.temp_id !== editing.temp_id);
      await persist(mergeTripInboxSegments(existing, [res.segment]));
      setEditing(null);
    } catch {
      setError(t('myTrip.correctError'));
    } finally {
      setBusy(false);
    }
  }, [draft, editing, persist, t]);

  const reviewCount = useMemo(
    () => segments.filter((s) => s.status === 'needs_review' || s.status === 'failed').length,
    [segments],
  );

  const stayHotel = useMemo(() => {
    const current = pickCurrentHotelStay(segments);
    if (current) return { seg: current, mode: 'current' as const };
    const upcoming = pickUpcomingHotelStay(segments);
    if (upcoming) return { seg: upcoming, mode: 'upcoming' as const };
    return null;
  }, [segments]);

  if (signedIn === false) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: D.bg }]}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        <OfflineBanner />
        <Text style={styles.title}>{t('myTrip.title')}</Text>
        <Text style={styles.subtitle}>{t('myTrip.signInBody')}</Text>
        <SocialAuthButtons successHref="/(tabs)/my-trip" />
        <Link href="/(tabs)/my-esim" asChild>
          <Pressable style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>{t('nav.myEsim')}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: D.bg, paddingTop: insets.top }]}>
      <OfflineBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Text style={styles.title}>{t('myTrip.title')}</Text>
        <Text style={styles.subtitle}>{t('myTrip.subtitle')}</Text>

        {stayHotel ? (
          <StayHotelCard
            segment={stayHotel.seg}
            mode={stayHotel.mode}
            t={t}
            onFix={() => openEdit(stayHotel.seg)}
          />
        ) : null}

        <Text style={styles.label}>{t('myTrip.pasteLabel')}</Text>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          multiline
          textAlignVertical="top"
          placeholder={t('myTrip.pastePlaceholder')}
          placeholderTextColor={D.muted}
          style={styles.input}
        />
        <Pressable
          disabled={busy || !paste.trim()}
          onPress={() => void onParse()}
          style={[styles.cta, (busy || !paste.trim()) && styles.ctaDisabled]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{t('myTrip.parseCta')}</Text>
          )}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void onUpload()} style={styles.uploadBtn}>
          <Text style={styles.uploadText}>{t('myTrip.uploadCta')}</Text>
        </Pressable>
        <Text style={styles.uploadHint}>{t('myTrip.uploadHint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.timelineHead}>
          <Text style={styles.section}>{t('myTrip.timeline')}</Text>
          {segments.length > 0 ? (
            <Pressable onPress={() => void persist([])}>
              <Text style={styles.clear}>{t('myTrip.clear')}</Text>
            </Pressable>
          ) : null}
        </View>
        {reviewCount > 0 ? (
          <Text style={styles.hint}>{t('myTrip.reviewHint').replace('{n}', String(reviewCount))}</Text>
        ) : null}

        {segments.length === 0 ? (
          <Text style={styles.empty}>{t('myTrip.empty')}</Text>
        ) : (
          segments.map((seg) => (
            <View key={seg.temp_id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardMeta}>
                    {seg.type} · {seg.provider}
                  </Text>
                  <Text style={styles.cardTitle}>{segmentTitle(seg)}</Text>
                  <Text style={styles.cardWhen}>{segmentWhen(seg)}</Text>
                </View>
                <Text style={[styles.badge, badgeStyle(seg.status)]}>{statusLabel(t, seg.status)}</Text>
              </View>
              {seg.issues.length > 0 ? (
                <Text style={styles.issues}>{seg.issues.join(', ')}</Text>
              ) : null}
              <Pressable onPress={() => openEdit(seg)}>
                <Text style={styles.fix}>{t('myTrip.fix')}</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={Boolean(editing)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{t('myTrip.fixTitle')}</Text>
            {Object.keys(draft).map((key) => (
              <View key={key} style={styles.field}>
                <Text style={styles.fieldLabel}>{key}</Text>
                <TextInput
                  value={draft[key] ?? ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                  style={styles.fieldInput}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.cancel}>{t('myTrip.cancel')}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => void saveEdit()} style={styles.cta}>
                <Text style={styles.ctaText}>{t('myTrip.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function segmentTitle(seg: TripParsedSegment): string {
  const p = seg.payload;
  if (p.type === 'flight') {
    const route = [p.dep_airport || p.dep_city, p.arr_airport || p.arr_city].filter(Boolean).join(' → ');
    return [p.flight_no, route].filter(Boolean).join(' · ') || 'Flight';
  }
  if (p.type === 'hotel') {
    return String(p.property_name_user || p.property_name_dest || p.property_name || 'Hotel');
  }
  if (p.type === 'experience') {
    return String(p.title || p.venue || 'Experience');
  }
  return String(p.vehicle_class || p.pickup_location || 'Car');
}

function segmentWhen(seg: TripParsedSegment): string {
  return seg.sort_at?.replace('T', ' ').slice(0, 16) || '—';
}

function statusLabel(t: (k: string) => string, status: TripParseStatus): string {
  if (status === 'confirmed') return t('myTrip.statusConfirmed');
  if (status === 'needs_review') return t('myTrip.statusNeedsReview');
  return t('myTrip.statusFailed');
}

function badgeStyle(status: TripParseStatus) {
  if (status === 'confirmed') return styles.badgeOk;
  if (status === 'needs_review') return styles.badgeReview;
  return styles.badgeFail;
}

function StayHotelCard({
  segment,
  mode,
  t,
  onFix,
}: {
  segment: TripParsedSegment;
  mode: 'current' | 'upcoming';
  t: (k: string) => string;
  onFix: () => void;
}) {
  const names = hotelDisplayNames(segment.payload);
  const destLabel = t(`myTrip.destLang.${names.destLang}`);
  const fmt = (v: unknown) =>
    typeof v === 'string' ? v.replace('T', ' ').slice(0, 16) : '—';
  return (
    <View style={styles.stayCard}>
      <View style={styles.stayHead}>
        <Text style={styles.stayBadge}>
          {mode === 'current' ? t('myTrip.currentStay') : t('myTrip.upcomingStay')}
        </Text>
        <Text style={styles.stayLang}>{destLabel}</Text>
      </View>
      <Text style={styles.stayLabel}>{t('myTrip.yourLanguage')}</Text>
      <Text style={styles.stayName}>{names.nameUser || t('myTrip.nameMissing')}</Text>
      {names.addrUser ? <Text style={styles.stayAddr}>{names.addrUser}</Text> : null}
      <View style={styles.stayLocalBox}>
        <Text style={styles.stayLabel}>
          {t('myTrip.localLanguage').replace('{lang}', destLabel)}
        </Text>
        <Text style={styles.stayNameLocal}>{names.nameDest || t('myTrip.localNameMissing')}</Text>
        {names.addrDest ? <Text style={styles.stayAddr}>{names.addrDest}</Text> : null}
      </View>
      <Text style={styles.stayWhen}>
        {t('myTrip.checkIn')}: {fmt(segment.payload.check_in_at)} · {t('myTrip.checkOut')}:{' '}
        {fmt(segment.payload.check_out_at)}
      </Text>
      {(!names.nameUser || !names.nameDest) && (
        <Pressable onPress={onFix}>
          <Text style={styles.fix}>{t('myTrip.addBilingualNames')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, ...fp('700'), color: P.ink, marginTop: 8 },
  subtitle: { marginTop: 6, fontSize: 14, ...fp('400'), color: D.muted, lineHeight: 20 },
  stayCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
  },
  stayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  stayBadge: { fontSize: 11, ...fp('700'), color: D.coral, textTransform: 'uppercase' },
  stayLang: { fontSize: 11, ...fp('400'), color: D.muted },
  stayLabel: { fontSize: 11, ...fp('600'), color: D.muted, textTransform: 'uppercase' },
  stayName: { marginTop: 2, fontSize: 17, ...fp('700'), color: P.ink },
  stayNameLocal: { marginTop: 2, fontSize: 16, ...fp('600'), color: P.ink },
  stayAddr: { marginTop: 4, fontSize: 13, ...fp('400'), color: D.muted },
  stayLocalBox: { marginTop: 12, backgroundColor: '#FFF8F5', borderRadius: 12, padding: 10 },
  stayWhen: { marginTop: 10, fontSize: 12, ...fp('400'), color: D.muted },
  label: { marginTop: 20, marginBottom: 8, fontSize: 13, ...fp('600'), color: P.ink },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    ...fp('400'),
    color: P.ink,
    backgroundColor: '#fff',
  },
  cta: {
    marginTop: 12,
    backgroundColor: D.navy,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', ...fp('700'), fontSize: 14 },
  uploadBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  uploadText: { color: D.navy, ...fp('700'), fontSize: 14 },
  uploadHint: { marginTop: 8, fontSize: 12, ...fp('400'), color: D.muted, lineHeight: 18 },
  error: { marginTop: 8, color: '#B42318', fontSize: 13, ...fp('400') },
  timelineHead: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  section: { fontSize: 18, ...fp('700'), color: P.ink },
  clear: { fontSize: 12, ...fp('400'), color: D.muted, textDecorationLine: 'underline' },
  hint: { marginTop: 6, fontSize: 12, ...fp('400'), color: '#92400E' },
  empty: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: D.border,
    borderRadius: 12,
    padding: 20,
    textAlign: 'center',
    color: D.muted,
    fontSize: 13,
    ...fp('400'),
  },
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 14,
  },
  cardTop: { flexDirection: 'row', gap: 10 },
  cardMeta: { fontSize: 11, ...fp('400'), color: D.muted, textTransform: 'uppercase' },
  cardTitle: { marginTop: 2, fontSize: 15, ...fp('600'), color: P.ink },
  cardWhen: { marginTop: 2, fontSize: 13, ...fp('400'), color: D.muted },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    ...fp('600'),
  },
  badgeOk: { backgroundColor: '#ECFDF3', color: '#067647' },
  badgeReview: { backgroundColor: '#FFFAEB', color: '#B54708' },
  badgeFail: { backgroundColor: '#FEF3F2', color: '#B42318' },
  issues: { marginTop: 8, fontSize: 11, ...fp('400'), color: '#92400E' },
  fix: { marginTop: 8, fontSize: 13, ...fp('600'), color: D.coral, textDecorationLine: 'underline' },
  secondaryLink: { marginTop: 16, alignItems: 'center' },
  secondaryLinkText: { color: D.coral, ...fp('600') },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, ...fp('700'), color: P.ink, marginBottom: 12 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, ...fp('400'), color: D.muted, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    ...fp('400'),
    color: P.ink,
  },
  modalActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  cancel: { fontSize: 14, ...fp('400'), color: D.muted },
});
