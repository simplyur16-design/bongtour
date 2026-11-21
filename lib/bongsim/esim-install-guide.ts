/**
 * eSIM 설치 안내·여행자 인증 경로.
 * REGRESSION-FREEZE[bongsim-esim-install-guide-pages]: 설치 안내 공개·인증은 메뉴 밖 — manifest
 */
export const ESIM_INSTALL_GUIDE_PATH = "/travel/esim/guide/install";
export const ESIM_TRAVELER_AUTH_PATH = "/travel/esim/guide/traveler-auth";

/** 화면에는 이 주소만 두고, 이름은 데이터 라벨을 쓴다. */
export const ESIM_INSTALL_CS_URL = "https://www.usimsa.com/board/contact-channel/";

export const ESIM_INSTALL_FAQ_QUESTION = "eSIM 설치 방법";

/** 여행자 인증 화면 문장. 챗봇도 이 배열만 읽는다. */
export const ESIM_TRAVELER_AUTH_BULLETS = [
  "홍콩·마카오·대만 상품 이용 시 여행자 인증이 필요합니다.",
  "중국 본토 단독 상품은 여행자 인증이 필요 없습니다.",
  "eSIM 설치 후 인증할 수 있어요.",
  "인증이 필요한 상품은 국내에서 미리 설치·인증해도 날짜가 차감되지 않아요.",
  "ICCID가 8985234로 시작 → 여행자 인증 필요 (홍콩·마카오·대만)",
  "그 외 ICCID(예: 90000·8985235 등) → 인증 불필요 (중국 본토 포함)",
  "ICCID는 주문 완료 화면·이메일·마이페이지에서 확인할 수 있어요.",
] as const
