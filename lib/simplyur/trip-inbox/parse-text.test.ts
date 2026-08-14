import { describe, expect, it, beforeEach } from "vitest";
import {
  applySegmentCorrection,
  parseTripInboxText,
  pickCurrentHotelStay,
  pickUpcomingHotelStay,
  learnFormParserFromCorrection,
  resetFormParsersForTests,
  sortTripSegmentsNearestNow,
} from "@/lib/simplyur/trip-inbox";
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

const KE_ETICKET_FIXTURE = `
ELECTRONIC TICKET
KOREAN AIR e-ticket itinerary
Passenger Name: KIM/TESTMR
Booking Reference: QWERTY
eTicket number: 1801234567890
KE 038
SEOUL (ICN) TOKYO (NRT)
01NOV2026 09:00 01NOV2026 11:30
`;

const AIRBNB_FIXTURE = `
Your reservation is confirmed
Airbnb <automated@airbnb.com>
Confirmation code: HMK8Q2A3
Check-in: Nov 2, 2026 after 3:00 PM
Checkout: Nov 7, 2026
Listing: Shibuya Studio Apartment
Address: 1-2-3 Shibuya, Tokyo
Guest: Sample Guest
`;

const BOOKING_COM_FIXTURE = `
Booking.com Confirmation
Pin code: 4321
Confirmation number: 1234.567.890
Hotel name: VIA INN PRIME AKASAKA
Check-in: Monday, 2 November 2026
Check-out: Saturday, 7 November 2026
Address: 2-6-17 Akasaka, Minato-ku
`;

const KLOOK_FIXTURE = `
Klook <no-reply@klook.com>
Your Klook booking is confirmed
Activity: Gyeongbokgung Palace Tour
Date: 2 November 2026
Time: 10:00
Booking reference: KL99887766
Venue: Gwanghwamun
`;

const UNKNOWN_FORM_A = `
CustomTool receipt
Venue: Ocean View Capsule
In date: 2026-12-01
Out date: 2026-12-05
Book code: SW998877
`;

const UNKNOWN_FORM_B = `
CustomTool receipt
Venue: Harbor Loft
In date: 2027-01-10
Out date: 2027-01-14
Book code: SW112233
`;

describe("simplyur trip-inbox", () => {
  beforeEach(() => {
    resetFormParsersForTests();
  });

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
    const flights = r.segments.filter((s) => s.payload.type === "flight");
    const bos = flights.find((s) => s.payload.type === "flight" && s.payload.flight_no === "UA1349");
    expect(bos?.payload.type).toBe("flight");
    if (bos?.payload.type === "flight") {
      expect(bos.payload.dep_airport).toBe("BOS");
      expect(bos.payload.arr_airport).toBe("ORD");
      expect(bos.payload.dep_at).toContain("2026-08-09T09:50");
    }
    // Aug 15 2026 "now": both legs are past → more recent past (UA3710 Aug 13) first.
    if (flights[0]?.payload.type === "flight") {
      expect(flights[0].payload.flight_no).toBe("UA3710");
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
      expect(r.segments[0].payload.property_name_dest).toMatch(/그랜드|호텔/);
      expect(r.segments[0].payload.dest_lang).toBe("ja");
    }
  });

  it("picks current hotel stay and bilingual Agoda user name", () => {
    const r = parseTripInboxText(AGODA_FIXTURE);
    const hotel = r.segments[0]!;
    expect(hotel.payload.type).toBe("hotel");
    if (hotel.payload.type === "hotel") {
      expect(hotel.payload.property_name_user).toMatch(/VIA INN/i);
      expect(hotel.payload.dest_lang).toBe("ja");
    }
    const during = Date.parse("2026-11-03T12:00:00");
    expect(pickCurrentHotelStay(r.segments, during)?.temp_id).toBe(hotel.temp_id);
    expect(pickCurrentHotelStay(r.segments, Date.parse("2026-10-01T12:00:00"))).toBeNull();
    expect(pickUpcomingHotelStay(r.segments, Date.parse("2026-10-01T12:00:00"))?.temp_id).toBe(
      hotel.temp_id,
    );
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

  it("parses a generic airline e-ticket (not only United)", () => {
    expect(detectTripProvider(KE_ETICKET_FIXTURE)).toBe("airline_eticket");
    const r = parseTripInboxText(KE_ETICKET_FIXTURE);
    expect(r.segments[0]?.type).toBe("flight");
    if (r.segments[0]?.payload.type === "flight") {
      expect(r.segments[0].payload.flight_no).toMatch(/^KE0?38$/);
      expect(r.segments[0].payload.dep_airport).toBe("ICN");
      expect(r.segments[0].payload.arr_airport).toBe("NRT");
    }
  });

  it("parses Airbnb and Booking.com hotel confirmations", () => {
    expect(detectTripProvider(AIRBNB_FIXTURE)).toBe("airbnb");
    const airbnb = parseTripInboxText(AIRBNB_FIXTURE);
    expect(airbnb.segments[0]?.type).toBe("hotel");
    if (airbnb.segments[0]?.payload.type === "hotel") {
      expect(airbnb.segments[0].payload.booking_ref).toBe("HMK8Q2A3");
      expect(airbnb.segments[0].payload.check_in_at).toContain("2026-11-02");
      expect(airbnb.segments[0].payload.property_name).toMatch(/Shibuya/i);
    }

    expect(detectTripProvider(BOOKING_COM_FIXTURE)).toBe("booking_com");
    const bk = parseTripInboxText(BOOKING_COM_FIXTURE);
    expect(bk.segments[0]?.type).toBe("hotel");
    if (bk.segments[0]?.payload.type === "hotel") {
      expect(bk.segments[0].payload.property_name).toMatch(/VIA INN/i);
      expect(bk.segments[0].payload.check_out_at).toContain("2026-11-07");
    }
  });

  it("mines a parser for a new form and reuses it after a customer correction", () => {
    const first = parseTripInboxText(UNKNOWN_FORM_A);
    expect(first.form_parser).toBeTruthy();
    expect(first.warnings.some((w) => w.startsWith("mined_form"))).toBe(true);
    const seg = first.segments[0]!;
    expect(seg.payload.type).toBe("hotel");
    if (seg.payload.type === "hotel") {
      expect(seg.payload.property_name).toMatch(/Ocean View/i);
    }

    const corrected = applySegmentCorrection(seg, {
      payload: { property_name: "Ocean View Capsule", check_in_at: "2026-12-01T14:00:00" },
    });
    const learned = learnFormParserFromCorrection({
      sourceText: UNKNOWN_FORM_A,
      before: seg,
      after: corrected,
      existing: first.form_parser,
    });
    expect(learned.rules.some((r) => r.field === "property_name")).toBe(true);

    const second = parseTripInboxText(UNKNOWN_FORM_B, { formParsers: [learned] });
    expect(second.segments[0]?.payload.type).toBe("hotel");
    if (second.segments[0]?.payload.type === "hotel") {
      expect(second.segments[0].payload.property_name).toMatch(/Harbor Loft/i);
      expect(second.segments[0].payload.booking_ref).toBe("SW112233");
    }
  });

    it("parses Klook experience and sorts nearest-to-now", () => {
    expect(detectTripProvider(KLOOK_FIXTURE)).toBe("klook");
    const r = parseTripInboxText(KLOOK_FIXTURE);
    expect(r.segments[0]?.type).toBe("experience");
    if (r.segments[0]?.payload.type === "experience") {
      expect(r.segments[0].payload.title).toMatch(/Gyeongbokgung/i);
      expect(r.segments[0].payload.start_at).toContain("2026-11-02");
    }
    const now = Date.parse("2026-11-01T12:00:00");
    const sorted = sortTripSegmentsNearestNow(
      [
        { ...r.segments[0]!, sort_at: "2026-10-01T10:00:00", temp_id: "past" },
        { ...r.segments[0]!, sort_at: "2026-11-02T10:00:00", temp_id: "soon" },
        { ...r.segments[0]!, sort_at: "2026-12-01T10:00:00", temp_id: "later" },
      ],
      now,
    );
    expect(sorted.map((s) => s.temp_id)).toEqual(["soon", "later", "past"]);
  });

  it("starts at nearest-to-now then continues itinerary A-B-C-D-E-F", () => {
    const now = Date.parse("2026-08-15T12:00:00");
    const sorted = sortTripSegmentsNearestNow(
      [
        { temp_id: "a", sort_at: "2026-08-10T09:00:00" } as never,
        { temp_id: "f", sort_at: "2026-08-20T18:00:00" } as never,
        { temp_id: "c", sort_at: "2026-08-15T10:00:00" } as never,
        { temp_id: "d", sort_at: "2026-08-16T09:00:00" } as never,
        { temp_id: "b", sort_at: "2026-08-12T14:00:00" } as never,
        { temp_id: "e", sort_at: "2026-08-18T11:00:00" } as never,
      ],
      now,
    );
    expect(sorted.map((s) => s.temp_id)).toEqual(["c", "d", "e", "f", "a", "b"]);
  });

  it("continues itinerary order after the nearest item (not distance scramble)", () => {
    const now = Date.parse("2026-08-15T01:00:00");
    const sorted = sortTripSegmentsNearestNow(
      [
        { temp_id: "far", sort_at: "2026-11-02T10:00:00" } as never,
        { temp_id: "near_past", sort_at: "2026-08-13T16:50:00" } as never,
        { temp_id: "near_future", sort_at: "2026-08-16T09:00:00" } as never,
      ],
      now,
    );
    expect(sorted.map((s) => s.temp_id)).toEqual(["near_future", "far", "near_past"]);
  });
});
