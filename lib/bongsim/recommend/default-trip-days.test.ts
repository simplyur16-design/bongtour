import { describe, expect, it } from "vitest";
import {
  pickDefaultTripDaysForDestination,
  resolveDefaultTripDays,
  SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS,
  snapTripDaysToAvailable,
} from "@/lib/bongsim/recommend/default-trip-days";

describe("resolveDefaultTripDays", () => {
  it("사용자 지정 — 일본 3·중국 4·동남아 5·유럽 10·미국 10", () => {
    expect(resolveDefaultTripDays("jp")).toBe(3);
    expect(resolveDefaultTripDays("cn")).toBe(4);
    expect(resolveDefaultTripDays("th")).toBe(5);
    expect(resolveDefaultTripDays("vn")).toBe(5);
    expect(resolveDefaultTripDays("fr")).toBe(10);
    expect(resolveDefaultTripDays("de")).toBe(10);
    expect(resolveDefaultTripDays("us")).toBe(10);
  });

  it("권역 패키지 — 유럽 10·동남아 5·홍콩마카오 3", () => {
    expect(resolveDefaultTripDays("rg-eu-42")).toBe(10);
    expect(resolveDefaultTripDays("rg-sea-3")).toBe(5);
    expect(resolveDefaultTripDays("rg-hk-mo")).toBe(3);
    expect(resolveDefaultTripDays("rg-cn-hk-mo")).toBe(4);
  });

  it("남미·오세아니아 — 12·7", () => {
    expect(resolveDefaultTripDays("br")).toBe(12);
    expect(resolveDefaultTripDays("au")).toBe(7);
  });
});

describe("snapTripDaysToAvailable", () => {
  it("정확 일치 우선", () => {
    expect(snapTripDaysToAvailable(5, [3, 5, 7])).toBe(5);
  });

  it("없으면 가장 가까운 catalog 일수", () => {
    expect(snapTripDaysToAvailable(4, [3, 5, 7])).toBe(3);
    expect(snapTripDaysToAvailable(10, [7, 15, 30])).toBe(7);
  });
});

describe("pickDefaultTripDaysForDestination", () => {
  it("일본 3일 선호 + catalog 5·7 → 5", () => {
    expect(pickDefaultTripDaysForDestination("jp", [5, 7, 10])).toBe(5);
  });

  it("simplyur 한국 기본 5일", () => {
    expect(SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS).toBe(5);
  });
});
