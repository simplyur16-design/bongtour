import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMMON_FAQ } from "@/lib/bongsim/esim-guide-content";
import { ESIM_INSTALL_AUTH_MARKDOWN, ESIM_INSTALL_GENERAL_MARKDOWN } from "@/lib/bongsim/esim-install-guide-copy";
import {
  ESIM_INSTALL_AUTH_PATH,
  ESIM_INSTALL_CS_URL,
  ESIM_INSTALL_FAQ_QUESTION,
  ESIM_INSTALL_GENERAL_PATH,
} from "@/lib/bongsim/esim-install-guide";
import {
  esimInstallHeadings,
  parseEsimInstallManuscript,
  publishEsimInstallManuscript,
} from "@/lib/bongsim/esim-install-manuscript";

function stepHeadings(markdown: string): string[] {
  return esimInstallHeadings(markdown).filter((heading) => /\d+단계/.test(heading));
}

function assertPublished(markdown: string, steps: number) {
  expect(stepHeadings(markdown)).toHaveLength(steps);
  expect(markdown).toContain(ESIM_INSTALL_CS_URL);
  expect(markdown).not.toContain("_fqTkK");
  expect(markdown).not.toContain("_xlxjrxlX");
  expect(markdown).not.toContain("pf.kakao.com");
  expect(markdown).not.toContain(".pdf");
  expect(markdown).not.toContain("확인 필요");
  expect(markdown).not.toContain("카카오톡 상담은");
  const images = parseEsimInstallManuscript(markdown).filter((block) => block.kind === "img");
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) {
    expect(image.src.startsWith("/travel/esim/guide/")).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", image.src))).toBe(true);
  }
}

describe("esim install guide pages", () => {
  it("publishes the auth manuscript as 33 steps without kakao or pdf", () => {
    assertPublished(ESIM_INSTALL_AUTH_MARKDOWN, 33);
  });

  it("publishes the general manuscript as 31 steps without kakao or pdf", () => {
    assertPublished(ESIM_INSTALL_GENERAL_MARKDOWN, 31);
  });

  it("drops the kakao row and the 확인 필요 label", () => {
    const published = publishEsimInstallManuscript(
      [
        "본문입니다. 카카오톡 상담은 **24시간 연중무휴**입니다.",
        "| 카카오톡 | @유심사 ([pf.kakao.com/_fqTkK/chat](https://pf.kakao.com/_fqTkK/chat)) |",
        "| 전화 | 1661-0158 |",
        "확인 필요: 개통 시점은 자료가 없다.",
        "![화면](img/screens/ios-01.png)",
      ].join("\n"),
    );
    expect(published).toContain("본문입니다.");
    expect(published).toContain("| 전화 | 1661-0158 |");
    expect(published).toContain("상품 페이지 안내를 따르세요");
    expect(published).toContain("](/travel/esim/guide/screens/ios-01.png)");
    expect(published).not.toContain("확인 필요");
    expect(published).not.toContain("_fqTkK");
    expect(published).not.toContain("카카오톡");
  });

  it("links both install pages from the eSIM FAQ", () => {
    const item = COMMON_FAQ.find((faq) => faq.q === ESIM_INSTALL_FAQ_QUESTION);
    expect(item?.links?.map((link) => link.href)).toEqual([
      ESIM_INSTALL_AUTH_PATH,
      ESIM_INSTALL_GENERAL_PATH,
    ]);
  });

  it("keeps both pages indexable", () => {
    for (const file of ["app/travel/esim/guide/auth/page.tsx", "app/travel/esim/guide/general/page.tsx"]) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toContain("index: true");
      expect(source).not.toContain("noindex");
    }
  });
});
