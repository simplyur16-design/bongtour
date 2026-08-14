/**
 * Pick a confirmation PDF / text file for Trip Inbox.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: document picker ingest — manifest
 */
export type PickedConfirmation = { text?: string; pdfBase64?: string; name?: string };

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[triple & 63] : '=';
  }
  return out;
}

export async function pickTripConfirmationFile(): Promise<PickedConfirmation | null> {
  try {
    const DocumentPicker = await import('expo-document-picker');
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'message/rfc822', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return null;
    const asset = res.assets[0];
    const mime = (asset.mimeType ?? '').toLowerCase();
    const name = (asset.name ?? '').toLowerCase();
    const resp = await fetch(asset.uri);
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.length > 6_000_000) throw new Error('pdf_too_large');
      return { pdfBase64: bytesToBase64(buf), name: asset.name };
    }
    const text = await resp.text();
    return { text, name: asset.name };
  } catch {
    return null;
  }
}
