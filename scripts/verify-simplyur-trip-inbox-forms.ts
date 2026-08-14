/**
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: Trip.com/Agoda/Rakuten + airline e-ticket + Airbnb/OTA
 * + instant form miner + customer correction updates parser — manifest
 */
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(rel: string, needles: string[]): void {
  const s = read(rel);
  const missing = needles.filter((n) => !s.includes(n));
  if (missing.length) {
    console.error(`FAIL ${rel} missing:\n` + missing.map((m) => `  - ${m}`).join("\n"));
    process.exit(1);
  }
}

must("lib/simplyur/trip-inbox/types.ts", [
  "airbnb",
  "airline_eticket",
  "learned_form",
  "TripFormParser",
  "klook",
  "experience",
]);
must("lib/simplyur/trip-inbox/learned-parsers.ts", [
  "learnFormParserFromCorrection",
  "mineFormParser",
]);
must("lib/simplyur/trip-inbox/parse-text.ts", [
  "parseAirbnbText",
  "parseAirlineEticketText",
  "mineFormParser",
  "parseKlookText",
  "sortTripSegmentsNearestNow",
]);
must("app/api/simplyur/trips/parse/route.ts", ["pdfBase64", "formParsers"]);
must("app/api/simplyur/trips/correct/route.ts", ["learnFormParserFromCorrection"]);
must("apps/simplyur-mobile/app/(tabs)/my-trip.tsx", [
  "uploadCta",
  "pickTripConfirmationFile",
  "correctTripSegment",
]);
must("components/simplyur/SimplyurMyTripClient.tsx", ["uploadCta", "onUploadFile"]);

console.log("OK: simplyur-trip-inbox-forms (parsers + learn + upload)");
