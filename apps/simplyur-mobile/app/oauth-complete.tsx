import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LOGIN_1B } from '@/src/constants/login-design';
import { saveCheckoutBuyerEmail } from '@/src/lib/checkout-buyer-email';
import { markWebOAuthSession } from '@/src/lib/web-oauth-session';

/** Legacy deep-link landing (web OAuth handoff retired; prefer native sign-in). */
export default function OAuthCompleteScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  useEffect(() => {
    markWebOAuthSession();
    saveCheckoutBuyerEmail(typeof params.email === 'string' ? params.email : '');
    router.replace('/(tabs)/my-esim');
  }, [params.email]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={LOGIN_1B.coral} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGIN_1B.bg,
  },
});
