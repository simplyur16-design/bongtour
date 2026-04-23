import type { DeviceCompatibilityBrandSection } from "./types";

export const DEVICE_COMPATIBILITY_CAUTION =
  "출시 지역·통신사 정책에 따라 eSIM이 없거나 비활성화된 단말이 있습니다. 해외 단독 출시·특정 이통사 전용 모델은 특히 주의가 필요해요. 구매 전 설정에서 eSIM 추가 가능 여부와 EID 표시를 반드시 확인해 주세요.";

export const DEVICE_COMPATIBILITY_BRANDS: DeviceCompatibilityBrandSection[] = [
  {
    brand: "Samsung",
    series: [
      {
        title: "Galaxy S",
        models: [
          "Galaxy S24 / S24+ / S24 Ultra",
          "Galaxy S23 / S23+ / S23 Ultra",
          "Galaxy S22 시리즈(단말·통신사 정책에 따라 상이)",
        ],
      },
      {
        title: "Galaxy Z",
        models: ["Galaxy Z Fold5 · Z Flip5", "Galaxy Z Fold4 · Z Flip4"],
      },
    ],
  },
  {
    brand: "Apple",
    series: [
      {
        title: "iPhone 15",
        models: ["iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max"],
      },
      {
        title: "iPhone 14",
        models: ["iPhone 14 / 14 Plus / 14 Pro / 14 Pro Max"],
      },
      {
        title: "iPhone 13 · SE · 12",
        models: ["iPhone 13 / 13 mini / 13 Pro / 13 Pro Max", "iPhone SE(3세대)", "iPhone 12 시리즈 이상(대부분)"],
      },
    ],
  },
];

export const DEVICE_EID_HELP_TITLE = "기기에서 확인하는 방법";
export const DEVICE_EID_HELP_LINES = [
  "EID(Embedded Identity Document)는 이 단말에 eSIM 프로필을 식별·등록할 때 쓰는 고유 번호예요. 설정 또는 전화 다이얼에서 표시되는지 확인해 주세요.",
  "전화 앱을 연 뒤 통화 입력란에 아래 코드를 입력하고 통화(발신)를 눌러, EID·IMEI 등 정보 화면이 나오는지 확인해 보세요.",
  "설정 → 일반 → 정보(또는 휴대전화 정보) 등에서 ‘EID’ 또는 ‘사용 가능한 SIM’ 항목이 있는지 살펴보세요. 메뉴 이름은 기기·OS마다 다를 수 있어요.",
];
