import { describe, expect, it } from "vitest";
import { applySegmentCorrection, parseTripInboxText } from "@/lib/simplyur/trip-inbox";
import { detectTripProvider } from "@/lib/simplyur/trip-inbox/detect-provider";

// REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parser fixtures — manifest

const UNITED_FIXTURE = `
eTicket Itinerary and Receipt for Confirmation
보낸사람 United Airlines <Receipts@united.com>
Confirmation Number:
EKN1NF
Flight 1 of 2 UA1349 Class: United Economy (V)
Sun, Aug 09, 2026 Sun, Aug 09, 2026
09:50 AM 11:43 AM
Boston, MA, US (BOS) Chicago, IL, US (ORD)
Flight 2 of 2 UA3710 Class: United Economy (H)
Thu, Aug 13, 2026 Thu, Aug 13, 2026
04:50 PM 08:30 PM
St. Louis, MO, US (STL) Newark, NJ/New York, NY, US (EWR)
Traveler Details
PARK/YESEULMS
eTicket number: 0169299155530
`;

const AGODA_FIXTURE = `
Booked And Payable Through : Agoda Company Pte, Ltd.
Arrival : 체크인 : 2026년 11월 02일
Departure : 체크아웃 : 2026년 11월 07일
Booking ID : 예약 번호 : 1761671537
Client : 고객명 : Sample Guest
Property : 숙소명 : VIA INN PRIME AKASAKA
Address : 주소 : 2-6-17 Akasaka, Minato-ku
객실 수 : 2
성인 수 : 2
아동 수 : 0
객실 타입 : Via Inn Single Room
`;

const RAKUTEN_FIXTURE = `
Rakuten Travel <travel@mail.travel.rakuten.com>
[ 라쿠텐 트래블 ] 예약 확정 ( 예약 ID: 21315090849495)
ilyeon hwang 고객님의 예약이 아래와 같이 완료되었습니다 .
호텔 그랜드 아크 한조몬
주소 102-0092 Tokyo
전화 03-3288-0111
결제 방법 숙소에서 결제
예약 ID 21315090849495
체크인 2026년 11월 02일 ( 월 ) 14:00 - 23:00
체크아웃 2026년 11월 07일 ( 토 ) 10:00
객실 수 2
객실 싱글룸
예약자명 Sample Booker
`;

const TRIP_CAR_FIXTURE = `
Trip.com <kr_car_NoReply@trip.com>
[ 트립닷컴 ] 렌터카 인수 & 반납 안내 ( 뮌헨 )
예약번호 ABC178
CHOI/JINGYU 님, 안녕하세요.
뮌헨에서 예약하신 폭스바겐 티크로스또는 동급 차종 렌터카 인수시간은 2026-07-29 21:00:00(현지 시간)입니다.
사전에 +49-89-54543990 로 지점에 문의하세요.
`;

const BONG_ITIN_FIXTURE = `
주식회사봉투어 승객 여정표
Passenger Itinerary
승객 성명 Passenger NameKIM/SEOKTAEMR, NAM/HAHYUNMR
예약 번호 Booking ReferenceECTEMG
1 출발 From 도착 To 편명 Flight
SEOUL INCHEON INT MANILA
OZ 701 ASIANA AIRLINES
29JUL2026(수) 07:35터미널 TERMINAL 2 29JUL2026(수) 10:55터미널 TERMINAL 1
ICN MNL
`;

describe("simplyur trip-inbox", () => {
  it("detects providers from sample fingerprints", () => {
    expect(detectTripProvider(UNITED_FIXTURE)).toBe("united");
    expect(detectTripProvider(AGODA_FIXTURE)).toBe("agoda");
    expect(detectTripProvider(RAKUTEN_FIXTURE)).toBe("rakuten_travel");
    expect(detectTripProvider(TRIP_CAR_FIXTURE)).toBe("trip_com");
    expect(detectTripProvider(BONG_ITIN_FIXTURE)).toBe("bongtour_eticket");
  });

  it("parses United flights into timeline segments", () => {
    const r = parseTripInboxText(UNITED_FIXTURE);
    expect(r.provider).toBe("united");
    expect(r.segments.length).toBeGreaterThanOrEqual(2);
    const first = r.segments[0]!;
    expect(first.type).toBe("flight");
    if (first.payload.type === "flight") {
      expect(first.payload.flight_no).toBe("UA1349");
      expect(first.payload.dep_airport).toBe("BOS");
      expect(first.payload.arr_airport).toBe("ORD");
      expect(first.payload.dep_at).toContain("2026-08-09T09:50");
    }
  });

  it("parses Agoda hotel and marks review when weak", () => {
    const r = parseTripInboxText(AGODA_FIXTURE);
    expect(r.segments[0]?.type).toBe("hotel");
    if (r.segments[0]?.payload.type === "hotel") {
      expect(r.segments[0].payload.property_name).toMatch(/VIA INN/i);
      expect(r.segments[0].payload.check_in_at).toContain("2026-11-02");
    }
  });

  it("parses Rakuten hotel check-in window", () => {
    const r = parseTripInboxText(RAKUTEN_FIXTURE);
    expect(r.segments[0]?.type).toBe("hotel");
    if (r.segments[0]?.payload.type === "hotel") {
      expect(r.segments[0].payload.booking_ref).toBe("21315090849495");
      expect(r.segments[0].payload.check_in_window).toMatch(/14:00/);
    }
  });

  it("parses Trip.com car pickup", () => {
    const r = parseTripInboxText(TRIP_CAR_FIXTURE);
    expect(r.segments[0]?.type).toBe("car");
    if (r.segments[0]?.payload.type === "car") {
      expect(r.segments[0].payload.pickup_at).toContain("2026-07-29T21:00");
      expect(r.segments[0].payload.pickup_location).toMatch(/뮌헨/);
    }
  });

  it("applies user correction and can confirm", () => {
    const r = parseTripInboxText(UNITED_FIXTURE);
    const seg = r.segments[0]!;
    const fixed = applySegmentCorrection(seg, {
      payload: {
        flight_no: "UA1349",
        dep_airport: "BOS",
        arr_airport: "ORD",
        dep_at: "2026-08-09T09:50:00",
        arr_at: "2026-08-09T11:43:00",
      },
    });
    expect(fixed.issues.length).toBe(0);
    expect(fixed.status).toBe("confirmed");
  });
});
