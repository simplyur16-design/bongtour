declare module 'expo-document-picker' {
  export function getDocumentAsync(opts: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
  }): Promise<
    | { canceled: true; assets: null }
    | {
        canceled: false;
        assets: Array<{ uri: string; mimeType?: string | null; name?: string | null }>;
      }
  >;
}
