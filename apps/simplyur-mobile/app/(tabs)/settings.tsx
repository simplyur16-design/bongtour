import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestSimplyurAccountWithdraw } from '@/src/api/account';
import { LOGIN_1B as D } from '@/src/constants/login-design';
import { BRAND, LOCALE_LABELS } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { signOutGoogleNativeBestEffort } from '@/src/lib/native-oauth';
import {
  clearSimplyurSession,
  loadSimplyurSession,
  type SimplyurSession,
} from '@/src/lib/session';

/**
 * Account & app settings — language, legal, support, sign-out, delete account.
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: settings surface — manifest
 */
export default function SettingsScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<SimplyurSession | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSimplyurSession().then(setSession);
  }, []);

  async function onSignOut() {
    Alert.alert(t('nav.signOut'), t('myEsim.signOutConfirm'), [
      { text: t('myEsim.close'), style: 'cancel' },
      {
        text: t('nav.signOut'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOutGoogleNativeBestEffort();
            await clearSimplyurSession();
            setSession(null);
          })();
        },
      },
    ]);
  }

  function onContactSupport() {
    const subject = encodeURIComponent(t('settings.supportSubject'));
    const url = `mailto:${BRAND.supportEmail}?subject=${subject}`;
    void Linking.openURL(url).catch(() => {
      Alert.alert(t('settings.supportTitle'), BRAND.supportEmail);
    });
  }

  function onDeleteAccount() {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('myEsim.close'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const res = await requestSimplyurAccountWithdraw();
            setBusy(false);
            if (!res.ok) {
              Alert.alert(t('settings.deleteTitle'), t('settings.deleteError'));
              return;
            }
            await signOutGoogleNativeBestEffort();
            await clearSimplyurSession();
            setSession(null);
            Alert.alert(t('settings.deleteTitle'), t('settings.deleteDone'), [
              { text: t('myEsim.close'), onPress: () => router.back() },
            ]);
          })();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backRow}>
        <Text style={styles.back}>← {t('settings.back')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('settings.title')}</Text>
      {session?.email ? (
        <Text style={styles.email}>{session.email}</Text>
      ) : (
        <Text style={styles.muted}>{t('settings.signedOutHint')}</Text>
      )}

      <Text style={styles.section}>{t('settings.sectionApp')}</Text>
      <Row
        label={t('nav.myTrip')}
        onPress={() => router.push('/(tabs)/my-trip')}
      />
      <Row
        label={t('language.label')}
        value={LOCALE_LABELS[locale]}
        onPress={() => router.push('/modal')}
      />

      <Text style={styles.section}>{t('settings.sectionLegal')}</Text>
      <Row
        label={t('legal.termsTitle')}
        onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
      />
      <Row
        label={t('legal.privacyTitle')}
        onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
      />
      <Row
        label={t('legal.refundTitle')}
        onPress={() => router.push({ pathname: '/legal', params: { doc: 'refund' } })}
      />

      <Text style={styles.section}>{t('settings.sectionSupport')}</Text>
      <Row label={t('settings.supportCta')} onPress={onContactSupport} />

      {session ? (
        <>
          <Text style={styles.section}>{t('settings.sectionAccount')}</Text>
          <Row label={t('nav.signOut')} onPress={() => void onSignOut()} />
          <Pressable
            disabled={busy}
            onPress={onDeleteAccount}
            style={[styles.dangerBtn, busy ? styles.dangerBtnBusy : null]}>
            <Text style={styles.dangerText}>
              {busy ? t('settings.deleteBusy') : t('settings.deleteCta')}
            </Text>
          </Pressable>
          <Text style={styles.dangerHint}>{t('settings.deleteHint')}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 10 },
  backRow: { marginBottom: 4 },
  back: { fontSize: 14, color: D.coral, ...fp('600') },
  title: { fontSize: 22, color: D.navy, ...fp('700'), marginBottom: 4 },
  email: { fontSize: 13, color: D.muted, ...fp('400'), marginBottom: 8 },
  muted: { fontSize: 13, color: D.muted, ...fp('400'), marginBottom: 8 },
  section: {
    marginTop: 14,
    marginBottom: 2,
    fontSize: 12,
    letterSpacing: 0.4,
    color: D.muted,
    ...fp('600'),
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, color: D.navy, ...fp('600'), flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: D.muted, ...fp('400') },
  chevron: { fontSize: 18, color: D.muted, lineHeight: 20 },
  dangerBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerBtnBusy: { opacity: 0.6 },
  dangerText: { fontSize: 15, color: '#b91c1c', ...fp('600') },
  dangerHint: { fontSize: 12, lineHeight: 18, color: D.muted, ...fp('400'), marginTop: 4 },
});
