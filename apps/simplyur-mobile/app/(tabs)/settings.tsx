import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestSimplyurAccountWithdraw } from '@/src/api/account';
import { SyIcon } from '@/src/components/ui/SyIcon';
import { Card, NavRow, ScreenHeader } from '@/src/components/ui/SyUi';
import { LOGIN_1B as D } from '@/src/constants/login-design';
import { SY } from '@/src/constants/theme';
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
 * REGRESSION-FREEZE[simplyur-esim-app-no-trip-tab]: settings has no My Trip — manifest
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
    // 고객센터 연결링크 → 고객센터 상담 페이지 (owner 11/20 20:43). If it can't open, fall back to mail, then the alert.
    const subject = encodeURIComponent(t('settings.supportSubject'));
    const mailUrl = `mailto:${BRAND.supportEmail}?subject=${subject}`;
    void Linking.openURL(BRAND.supportContactUrl).catch(() => {
      void Linking.openURL(mailUrl).catch(() => {
        Alert.alert(t('settings.supportTitle'), BRAND.supportEmail);
      });
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
      <ScreenHeader title={t('settings.title')} backLabel={t('settings.back')} onBack={() => router.back()} />

      <View style={styles.account}>
        <View style={styles.avatar}>
          <SyIcon name="user" size={20} color={SY.primary} strokeWidth={2} />
        </View>
        <Text style={styles.accountText} numberOfLines={2}>
          {session?.email ? session.email : t('settings.signedOutHint')}
        </Text>
      </View>

      <Text style={styles.section}>{t('settings.sectionApp')}</Text>
      <Card>
        <NavRow
          icon="globe"
          label={t('language.label')}
          value={LOCALE_LABELS[locale]}
          onPress={() => router.push('/modal')}
        />
      </Card>

      <Text style={styles.section}>{t('settings.sectionSupport')}</Text>
      <Card>
        <NavRow icon="headset" label={t('settings.supportCta')} onPress={onContactSupport} />
      </Card>
      <Text style={styles.hint}>{t('settings.supportHours')}</Text>

      <Text style={styles.section}>{t('settings.sectionLegal')}</Text>
      <Card>
        <NavRow
          icon="doc"
          label={t('legal.termsTitle')}
          divider
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
        />
        <NavRow
          icon="shield"
          label={t('legal.privacyTitle')}
          divider
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
        />
        <NavRow
          icon="refund"
          label={t('legal.refundTitle')}
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'refund' } })}
        />
      </Card>

      {session ? (
        <>
          <Text style={styles.section}>{t('settings.sectionAccount')}</Text>
          <Card>
            <NavRow icon="logout" label={t('nav.signOut')} divider onPress={() => void onSignOut()} />
            <NavRow
              icon="trash"
              tone="danger"
              label={busy ? t('settings.deleteBusy') : t('settings.deleteCta')}
              onPress={() => {
                if (!busy) onDeleteAccount();
              }}
            />
          </Card>
          <Text style={styles.hint}>{t('settings.deleteHint')}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 8 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: D.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountText: { flex: 1, fontSize: 14, lineHeight: 19, color: D.navy, ...fp('600') },
  section: {
    marginTop: 14,
    marginBottom: 2,
    fontSize: 12,
    letterSpacing: 0.4,
    color: D.faint,
    ...fp('600'),
    textTransform: 'uppercase',
  },
  hint: { fontSize: 12.5, lineHeight: 18, color: D.faint, ...fp('400'), paddingHorizontal: 4 },
});
