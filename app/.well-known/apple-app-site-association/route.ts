import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * AASA must be served as application/json (no .json extension).
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: Universal Links AASA — manifest
 */
export async function GET() {
  const teamId =
    process.env.AUTH_APPLE_TEAM_ID?.trim() ||
    process.env.APPLE_TEAM_ID?.trim() ||
    "9XQLXGRH49";
  const body = {
    applinks: {
      apps: [] as string[],
      details: [
        {
          appID: `${teamId}.com.bongtour.simplyur`,
          paths: ["/simplyur/*", "/simplyur"],
        },
      ],
    },
  };
  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
