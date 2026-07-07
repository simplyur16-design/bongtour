import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LOGIN_1B } from '@/src/constants/login-design';
import { markWebOAuthSession } from '@/src/lib/web-oauth-session';

/** simplyur://oauth-complete — WebBrowser.openAuthSessionAsync 복귀 */
export default function OAuthCompleteScreen() {
  useEffect(() => {
    markWebOAuthSession();
    router.replace('/(tabs)/my-esim');
  }, []);

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
