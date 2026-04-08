# -*- coding: utf-8 -*-
"""하나투어 E2E 다중 URL 검증셋용 JSON 출력 (최대 URL 수 제한)."""
from __future__ import annotations

import asyncio
import json
import os
import sys


async def _amain() -> int:
    urls: list[str] = []
    if len(sys.argv) > 1:
        urls = [u.strip() for u in sys.argv[1:] if "http" in (u or "")]
    else:
        raw = (os.environ.get("HANATOUR_E2E_VALIDATION_URLS") or "").strip()
        urls = [u.strip() for u in raw.split(",") if "http" in (u or "")]
    if not urls:
        sys.stderr.write(
            "Usage: python -m scripts.validate_hanatour_e2e_validation_set <url> [url...]\n"
            "Or: HANATOUR_E2E_VALIDATION_URLS=url1,url2,...\n"
        )
        return 1
    from scripts.calendar_e2e_scraper_hanatour.calendar_price_scraper import (
        collect_hanatour_departure_inputs,
    )

    mo = 1
    if os.environ.get("HANATOUR_E2E_VALIDATION_MAX_MONTHS"):
        try:
            mo = max(1, int(os.environ["HANATOUR_E2E_VALIDATION_MAX_MONTHS"]))
        except ValueError:
            mo = 1
    out: dict[str, object] = {"runs": []}
    partial_reason_counts: dict[str, int] = {}
    for url in urls[:16]:
        r = await collect_hanatour_departure_inputs(url, max_months=mo, headless=True)
        val = r.get("validation") if isinstance(r.get("validation"), dict) else {}
        summaries = val.get("departureSummaries") or []
        if isinstance(summaries, list):
            for s in summaries:
                if not isinstance(s, dict):
                    continue
                if str(s.get("verificationTier") or "") != "partial_success":
                    continue
                reason = s.get("partialSuccessReason")
                key = str(reason) if reason is not None else "(null)"
                partial_reason_counts[key] = partial_reason_counts.get(key, 0) + 1
        out["runs"].append(
            {
                "detailUrl": url,
                "collectorStatus": r.get("collectorStatus"),
                "validation": r.get("validation"),
                "departureCount": len(r.get("departures") or []),
                "firstVerificationTier": (
                    (r.get("departures") or [{}])[0].get("verificationTier")
                    if (r.get("departures") or [])
                    else None
                ),
                "notes": r.get("notes"),
            }
        )
    top_partial_reason: str | None = None
    if partial_reason_counts:
        top_partial_reason = max(partial_reason_counts.items(), key=lambda x: x[1])[0]
    out["partialSuccessReasonCounts"] = partial_reason_counts
    out["topPartialSuccessReason"] = top_partial_reason
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(_amain()))


if __name__ == "__main__":
    main()
