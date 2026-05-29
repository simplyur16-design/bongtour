// esim-guide-image-manifest.ts
// ──────────────────────────────────────────────────────────────────
// 유심사 가이드 설치 이미지 → 봉투어 NCloud 이관 매니페스트 (필요 컷만)
//
// - source: 유심사 channel.io 문서의 cf.channel.io 이미지 URL (사용 허가됨)
// - 봉투어 자체 화면(마이페이지 발급/내데이터)은 유심사 이미지 아님 → 제외(자체 캡처)
// - OS 설정 단계(설치/활성화/삭제) = 텍스트만으론 약한 핵심 구간만 선별
// - dest: bongtour 버킷, photo-pool/esim-guide/ 프리픽스
// - image_assets insert: entity_type='bongsim_esim_guide', image_role='gallery',
//   service_type='support', storage_bucket='bongtour', source_type='imported',
//   source_name='usimsa', is_generated=false
//
// guideKey = esim-guide-content.ts의 각 GuideBlock.image 를 이 key로 연결.
// 브랜딩(유심사 로고/홈피 UI) 포함 가능 컷은 note에 표기 → 운영자 사후 교체.
// ──────────────────────────────────────────────────────────────────

export interface EsimGuideImageManifestItem {
  guideKey: string;        // GuideBlock.image 매칭 키 (안정 식별자)
  os: "common" | "ios" | "android";
  step: string;            // 단계 라벨
  sourceUrl: string;       // 유심사 원본 cf.channel.io URL
  destKey: string;         // NCloud storage_path (photo-pool/esim-guide/...)
  altKr: string;
  brandingRisk: boolean;   // true=유심사 UI/로고 가능 → 운영자 사후 교체 후보
}

export const ESIM_GUIDE_IMAGE_MANIFEST: EsimGuideImageManifestItem[] = [
  // ── 공통(사전점검) ──
  {
    guideKey: "precheck_secure_network",
    os: "common",
    step: "안전 네트워크 / 설치 실패 시",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/67ff85c4c13f61c3765c",
    destKey: "photo-pool/esim-guide/common_secure_network.png",
    altKr: "안전한 네트워크에서 eSIM 설치 안내",
    brandingRisk: false,
  },

  // ── iOS 설치 ──
  {
    guideKey: "ios_install_oneclick",
    os: "ios",
    step: "원클릭 설치 진행",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/6808a3dfeb8500b97ca1",
    destKey: "photo-pool/esim-guide/ios_install_oneclick.png",
    altKr: "iPhone eSIM 원클릭 설치 및 설정 화면",
    brandingRisk: true,
  },
  // ── iOS 활성화(로밍) ──
  {
    guideKey: "ios_activate_predeparture",
    os: "ios",
    step: "출국 전 국내 전용 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/672af04183c1c7ccdaaa",
    destKey: "photo-pool/esim-guide/ios_activate_predeparture.png",
    altKr: "iPhone 출국 전 국내 전용 설정 화면",
    brandingRisk: false,
  },
  {
    guideKey: "ios_activate_roaming",
    os: "ios",
    step: "로밍망 도착 후 활성화 (간단 이미지)",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/44318/revisions/621909/usermedia/68de7864af194ef59acc",
    destKey: "photo-pool/esim-guide/ios_activate_roaming.png",
    altKr: "iPhone 로밍망 eSIM 활성화 설정",
    brandingRisk: false,
  },
  // ── iOS 활성화(로컬) 국가별 ──
  {
    guideKey: "ios_local_jp",
    os: "ios",
    step: "일본 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130668/revisions/695461/usermedia/68fb163de9af8d371b35",
    destKey: "photo-pool/esim-guide/ios_local_jp.png",
    altKr: "iPhone 일본 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "ios_local_vn",
    os: "ios",
    step: "베트남 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130668/revisions/695461/usermedia/68fb16647f9a6c94da6b",
    destKey: "photo-pool/esim-guide/ios_local_vn.png",
    altKr: "iPhone 베트남 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "ios_local_th",
    os: "ios",
    step: "태국 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/68fb167da82f6f386a5f",
    destKey: "photo-pool/esim-guide/ios_local_th.png",
    altKr: "iPhone 태국 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "ios_local_eu",
    os: "ios",
    step: "유럽 33/36개국 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/68fb169b560fcf40d4a9",
    destKey: "photo-pool/esim-guide/ios_local_eu.png",
    altKr: "iPhone 유럽 로컬망 eSIM 설정(데이터 로밍 ON)",
    brandingRisk: false,
  },
  {
    guideKey: "ios_local_la",
    os: "ios",
    step: "라오스 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/68fb16ba4c58dd2ca1ac",
    destKey: "photo-pool/esim-guide/ios_local_la.png",
    altKr: "iPhone 라오스 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  // ── iOS 삭제 ──
  {
    guideKey: "ios_delete",
    os: "ios",
    step: "eSIM 제거",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/47365/revisions/695487/usermedia/68fb181c8beff0c4f3ff",
    destKey: "photo-pool/esim-guide/ios_delete.png",
    altKr: "iPhone eSIM 삭제 화면",
    brandingRisk: false,
  },

  // ── Android 설치 ──
  {
    guideKey: "android_install_qr",
    os: "android",
    step: "QR 설치 및 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/6808a1fad1090d7fde3c",
    destKey: "photo-pool/esim-guide/android_install_qr.png",
    altKr: "Android eSIM QR 설치 및 설정 화면",
    brandingRisk: true,
  },
  // ── Android 활성화(로밍) ──
  {
    guideKey: "android_activate_roaming",
    os: "android",
    step: "로밍망 도착 후 활성화 (간단 이미지)",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/47414/revisions/621982/usermedia/68fad54f61e62ddb6e63",
    destKey: "photo-pool/esim-guide/android_activate_roaming.png",
    altKr: "Android 로밍망 eSIM 활성화 설정",
    brandingRisk: false,
  },
  // ── Android 활성화(로컬) 국가별 ──
  {
    guideKey: "android_local_jp",
    os: "android",
    step: "일본 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130696/revisions/621998/usermedia/68fadfdd2a368dfad051",
    destKey: "photo-pool/esim-guide/android_local_jp.png",
    altKr: "Android 일본 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "android_local_vn",
    os: "android",
    step: "베트남 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130696/revisions/621998/usermedia/68fadfe7dd6337f38538",
    destKey: "photo-pool/esim-guide/android_local_vn.png",
    altKr: "Android 베트남 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "android_local_th",
    os: "android",
    step: "태국 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130696/revisions/621998/usermedia/68fadff865b2e0f7644a",
    destKey: "photo-pool/esim-guide/android_local_th.png",
    altKr: "Android 태국 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "android_local_eu",
    os: "android",
    step: "유럽 33/36개국 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/68fadfc3bd39863c6f7f",
    destKey: "photo-pool/esim-guide/android_local_eu.png",
    altKr: "Android 유럽 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  {
    guideKey: "android_local_la",
    os: "android",
    step: "라오스 로컬망 설정",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/articles/130696/revisions/621998/usermedia/68fae0138aeeb1fc4ab4",
    destKey: "photo-pool/esim-guide/android_local_la.png",
    altKr: "Android 라오스 로컬망 eSIM 설정",
    brandingRisk: false,
  },
  // ── Android 삭제 ──
  {
    guideKey: "android_delete",
    os: "android",
    step: "eSIM 제거",
    sourceUrl: "https://cf.channel.io/document/spaces/6214/usermedia/6808a23238c89494c95e",
    destKey: "photo-pool/esim-guide/android_delete.png",
    altKr: "Android eSIM 삭제 화면",
    brandingRisk: false,
  },
];
