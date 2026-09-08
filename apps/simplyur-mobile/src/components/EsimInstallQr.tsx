import { Image, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { MY_ESIM_DESIGN as D } from '@/src/constants/my-esim-design';
import { fp } from '@/src/constants/typography';

/**
 * Real install QR from LPA (or supplier image). Never decorative "QR CODE" art.
 * REGRESSION-FREEZE[simplyur-my-esim-paid-qr-install]: LPA QR — manifest
 */
export function EsimInstallQr({
  lpa,
  imageUrl,
  pendingLabel,
}: {
  lpa: string | null;
  imageUrl: string | null;
  pendingLabel: string;
}) {
  if (lpa?.startsWith('LPA:')) {
    return (
      <View style={styles.qrFrame} accessibilityLabel="eSIM install QR">
        <QRCode value={lpa} size={152} backgroundColor="#fff" color={D.navy} />
      </View>
    );
  }
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={styles.qrImage} resizeMode="contain" />;
  }
  return (
    <View style={styles.waiting}>
      <Text style={styles.waitingText}>{pendingLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrFrame: {
    width: 168,
    height: 168,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: { width: 168, height: 168, borderRadius: 14 },
  waiting: {
    width: 168,
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: D.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  waitingText: {
    fontSize: 12,
    lineHeight: 18,
    ...fp('400'),
    color: D.muted,
    textAlign: 'center',
  },
});
