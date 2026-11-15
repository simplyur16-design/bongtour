import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EsimGuideSiteView } from "@/components/bongsim/esim/EsimGuideSiteView";
import { COMMON_FAQ } from "@/lib/bongsim/esim-guide-content";

vi.mock("next/image", () => {
  const React = require("react") as typeof import("react");
  return {
    __esModule: true,
    default: (props: { alt?: string; src?: string }) =>
      React.createElement("img", { alt: props.alt ?? "", src: typeof props.src === "string" ? props.src : "" }),
  };
});

vi.mock("next/link", () => {
  const React = require("react") as typeof import("react");
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children?: import("react").ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});
import { ESIM_GUIDE_SITE_DATA, esimGuideLocale, esimGuideScreen } from "@/lib/bongsim/esim-guide-site/load";
import {
  ESIM_INSTALL_CS_URL,
  ESIM_INSTALL_FAQ_QUESTION,
  ESIM_INSTALL_GUIDE_PATH,
  ESIM_TRAVELER_AUTH_PATH,
} from "@/lib/bongsim/esim-install-guide";

const FORBIDDEN = ["_fqTkK", "_xlxjrxlX", "pf.kakao.com"];

describe("esim guide site data", () => {
  it("falls back to the default locale", () => {
    expect(esimGuideLocale("en").locale).toBe(ESIM_GUIDE_SITE_DATA.defaultLocale);
    expect(esimGuideLocale("en").content.guide.title).toBe(esimGuideLocale("ko").content.guide.title);
  });

  it("keeps the published step counts and hides downloads", () => {
    const content = esimGuideLocale("ko").content;
    expect(content.guide.platforms.iphone.steps).toHaveLength(7);
    expect(content.guide.platforms.galaxy.steps).toHaveLength(8);
    expect(content.auth.verification.steps).toHaveLength(2);
    expect(content.guide.prep.cards).toHaveLength(5);
    expect(content.faq.downloads).toEqual([]);
    expect(content.common.moreLabel).toBe("자세히 보기");
  });

  it("resolves every image key to a file under the ko public folder", () => {
    const content = esimGuideLocale("ko").content;
    const keys = [
      ...content.guide.platforms.iphone.steps.flatMap((step) => [step.imageKey, ...step.details.map((detail) => detail.imageKey)]),
      ...content.guide.platforms.galaxy.steps.flatMap((step) => [step.imageKey, ...step.details.map((detail) => detail.imageKey)]),
      ...content.auth.verification.steps.map((step) => step.imageKey),
    ];
    for (const key of keys) {
      const image = esimGuideScreen(key, "ko");
      expect(image.src).toContain("/ko/");
      expect(image.width).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(process.cwd(), "public", image.src))).toBe(true);
    }
  });

  it("keeps supplier names off the screen copy and uses only the contact URL", () => {
    const blob = JSON.stringify(esimGuideLocale("ko").content);
    expect(blob).not.toMatch(/유심사|USIMSA/);
    expect(ESIM_GUIDE_SITE_DATA.support.web.url).toBe(ESIM_INSTALL_CS_URL);
    expect(ESIM_INSTALL_CS_URL).toBe("https://www.usimsa.com/board/contact-channel/");
    const files = [
      "lib/bongsim/esim-guide-site/esim-guide.data.json",
      "components/bongsim/esim/EsimGuideSiteView.tsx",
      "app/travel/esim/guide/install/page.tsx",
      "app/travel/esim/guide/traveler-auth/page.tsx",
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const token of FORBIDDEN) expect(source).not.toContain(token);
      expect(source).not.toMatch(/\.pdf/);
    }
  });

  it("renders prep, iphone, and galaxy in the server HTML and hides the inactive panels", () => {
    const html = renderToStaticMarkup(createElement(EsimGuideSiteView, { page: "guide" }));
    const open = (id: "prep" | "iphone" | "galaxy") => {
      const match = html.match(new RegExp(`<div[^>]*data-esim-guide-tab="${id}"[^>]*>`));
      expect(match, id).not.toBeNull();
      return match![0];
    };
    expect(open("prep")).not.toMatch(/\shidden(?:="[^"]*")?/);
    expect(open("iphone")).toMatch(/\shidden(?:="[^"]*")?/);
    expect(open("galaxy")).toMatch(/\shidden(?:="[^"]*")?/);
    expect(html).toContain("내 상품부터 확인하세요");
    expect(html).toContain("iPhone 바로 설치");
    expect(html).toContain("QR 이미지를 길게 눌러");
    expect(html).toContain("개통·장애 문의");
  });

  it("links the install page from FAQ and the auth page when the answer names it", () => {
    const item = COMMON_FAQ.find((faq) => faq.q === ESIM_INSTALL_FAQ_QUESTION);
    expect(item?.a).toMatch(/인증이 필요한 상품/);
    expect(item?.links?.map((link) => link.href)).toEqual([ESIM_INSTALL_GUIDE_PATH, ESIM_TRAVELER_AUTH_PATH]);
  });
});
