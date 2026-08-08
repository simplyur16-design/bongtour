import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalPinIcon } from '@/src/components/auth/SignalPinIcon';
import { SocialAuthButtons } from '@/src/components/auth/SocialAuthButtons';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * design_handoff_login_1b — in-app Apple · Google · Email (no external auth window).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: native chooser — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: native Google SDK only — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-social-signin]: SocialAuthButtons — manifest
 */
export default function SignInChooserScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) }]}>
      <Pressable
        onPress={() => router.replace('/(tabs)')}
        style={[styles.skip, { top: Math.max(insets.top + 12, LOGIN_1B.skipTop) }]}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{t('auth.skip')}</Text>
      </Pressable>

      <View style={styles.spacer} />

      <View style={styles.hero}>
        <SignalPinIcon />
        <View style={styles.headingStack}>
          <Text style={styles.welcomeTitle}>{t('auth.welcomeTitle')}</Text>
          <Text style={styles.welcomeSubtitle}>{t('auth.welcomeSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <SocialAuthButtons />
        <Pressable
          onPress={() => router.push('/sign-in/sign-up')}
          accessibilityRole="button"
          style={styles.signupLink}
        >
          <Text style={styles.signupLinkText}>
            {t('auth.noAccount')} {t('auth.signUpLink')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGIN_1B.bg,
    paddingHorizontal: LOGIN_1B.paddingH,
    paddingBottom: LOGIN_1B.paddingBottom,
    position: 'relative',
  },
  skip: {
    position: 'absolute',
    right: LOGIN_1B.paddingH,
    zIndex: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 13,
    color: LOGIN_1B.faint,
    ...fp('400'),
  },
  spacer: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: LOGIN_1B.logoGap,
    marginBottom: LOGIN_1B.blockMarginBottom,
  },
  headingStack: {
    alignItems: 'center',
    gap: LOGIN_1B.headingGap,
  },
  welcomeTitle: {
    fontSize: 24,
    color: LOGIN_1B.navy,
    letterSpacing: -0.24,
    textAlign: 'center',
    ...fp('600'),
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: LOGIN_1B.muted,
    textAlign: 'center',
    lineHeight: 19.5,
    ...fp('400'),
  },
  buttons: {
    gap: LOGIN_1B.buttonGap,
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signupLinkText: {
    fontSize: 13,
    color: LOGIN_1B.coral,
    textAlign: 'center',
    ...fp('600'),
  },
});
