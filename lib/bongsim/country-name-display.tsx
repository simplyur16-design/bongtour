import { Fragment } from "react";

/** 강제 줄바꿈(표시 전용). 키는 `COUNTRY_OPTIONS.nameKr` 및 공백 제거 변형 모두 조회. */
const COUNTRY_NAME_DISPLAY: Record<string, string> = {
  남아프리카공화국: "남아프리카\n공화국",
  북마리아나제도: "북마리아나\n제도",
  사우디아라비아: "사우디\n아라비아",
  아랍에미레이트: "아랍\n에미리트",
  아랍에미리트: "아랍\n에미리트",
  보스니아헤르체고비나: "보스니아\n헤르체고비나",
  "보스니아 헤르체고비나": "보스니아\n헤르체고비나",
  도미니카공화국: "도미니카\n공화국",
  덴마크령페로제도: "덴마크령\n페로 제도",
  "덴마크령 페로 제도": "덴마크령\n페로 제도",
};

function compactKey(s: string): string {
  return s.replace(/\s+/g, "");
}

export function getCountryDisplayText(nameKr: string): string {
  const t = nameKr.trim();
  return COUNTRY_NAME_DISPLAY[t] ?? COUNTRY_NAME_DISPLAY[compactKey(t)] ?? t;
}

const NAME_LINE_CLASS =
  "max-w-[4.5rem] text-center break-keep leading-tight";

type CountryNameMultilineProps = {
  nameKr: string;
  className?: string;
};

/**
 * 국가명: 매핑에 `\n`이 있으면 `<br />`로 분리, 없으면 한 줄.
 * 긴 이름은 `max-w-[4.5rem] break-keep`으로 두 줄 내외 정렬.
 */
export function CountryNameMultiline({ nameKr, className }: CountryNameMultilineProps) {
  const display = getCountryDisplayText(nameKr);
  const lines = display.split("\n");
  const merged = [NAME_LINE_CLASS, className].filter(Boolean).join(" ");

  return (
    <span className={merged}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </span>
  );
}
