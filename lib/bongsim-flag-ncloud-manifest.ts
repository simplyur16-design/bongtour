/**
 * ISO alpha-2 → NCloud 공개 URL (scripts/rehost-all-external-cdn-to-ncloud.ts --sync-bongsim-flags 로 갱신).
 * 비어 있으면 `resolveBongsimFlagImageUrl` 이 flagcdn 폴백을 쓴다.
 */
export const BONGSIM_FLAG_NCLOUD_BY_ISO: Readonly<Record<string, string>> = {}
