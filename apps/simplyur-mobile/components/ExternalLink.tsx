import { Link, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

/**
 * In-app WebView for http(s) links — never opens system browser on native.
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: ExternalLink — manifest
 */
export function ExternalLink(props: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  return (
    <Link
      {...props}
      href={props.href}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          e.preventDefault();
          router.push({
            pathname: '/in-app-web',
            params: { path: props.href },
          });
        }
      }}
    />
  );
}
