/**
 * Sentry + lightweight funnel events (no-op without DSN).
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: telemetry — manifest
 */
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

let initialized = false;

function resolveSentryDsn(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { sentryDsn?: string } | undefined;
  return (extra?.sentryDsn ?? '').trim();
}

export function initSimplyurTelemetry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = resolveSentryDsn();
  if (!dsn) return;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  Sentry.init({
    dsn,
    enabled: !isDev,
    tracesSampleRate: 0.15,
    environment: isDev ? 'development' : 'production',
  });
}

export function trackSimplyurEvent(
  name: string,
  data?: Record<string, string | number | boolean | undefined>,
): void {
  if (!resolveSentryDsn()) return;
  Sentry.addBreadcrumb({
    category: 'simplyur.funnel',
    message: name,
    data: data ?? {},
    level: 'info',
  });
}

export function captureSimplyurError(error: unknown, context?: string): void {
  if (!resolveSentryDsn()) return;
  Sentry.captureException(error, context ? { tags: { simplyur_context: context } } : undefined);
}
