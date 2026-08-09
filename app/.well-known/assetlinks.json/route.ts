import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Android App Links Digital Asset Links.
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: assetlinks — manifest
 */
export async function GET() {
  const fingerprints = (
    process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS ??
    "REPLACE_WITH_PLAY_APP_SIGNING_SHA256"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.bongtour.simplyur",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
