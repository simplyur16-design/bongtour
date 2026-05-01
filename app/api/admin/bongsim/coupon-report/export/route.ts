import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const yRaw = searchParams.get("year");
  const mRaw = searchParams.get("month");
  const year = yRaw ? Number.parseInt(yRaw, 10) : now.getUTCFullYear();
  const month = mRaw ? Number.parseInt(mRaw, 10) : now.getUTCMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid_year_month" }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  try {
    const r = await pool.query<{
      used_at: Date;
      order_number: string;
      code: string;
      description: string | null;
      original_amount_krw: string;
      discount_amount_krw: string;
      final_amount_krw: string;
      buyer_email: string;
    }>(
      `SELECT u.used_at,
              o.order_number,
              c.code,
              c.description,
              u.original_amount_krw::text AS original_amount_krw,
              u.discount_amount_krw::text AS discount_amount_krw,
              u.final_amount_krw::text AS final_amount_krw,
              o.buyer_email
         FROM bongsim_coupon_usage u
         JOIN bongsim_order o ON o.order_id = u.order_id
         JOIN bongsim_coupon c ON c.coupon_id = u.coupon_id
        WHERE u.used_at >= $1 AND u.used_at < $2
        ORDER BY u.used_at ASC`,
      [start.toISOString(), end.toISOString()],
    );

    let sumOrig = 0;
    let sumDisc = 0;
    let sumFinal = 0;
    const header = ["날짜", "주문번호", "쿠폰코드", "쿠폰설명", "원가", "할인액", "결제액", "사용자이메일"];
    const lines: string[] = [header.map(csvCell).join(",")];

    for (const row of r.rows) {
      const oa = Number.parseInt(row.original_amount_krw, 10) || 0;
      const da = Number.parseInt(row.discount_amount_krw, 10) || 0;
      const fa = Number.parseInt(row.final_amount_krw, 10) || 0;
      sumOrig += oa;
      sumDisc += da;
      sumFinal += fa;
      lines.push(
        [
          csvCell(row.used_at.toISOString()),
          csvCell(row.order_number),
          csvCell(row.code),
          csvCell(row.description ?? ""),
          csvCell(oa),
          csvCell(da),
          csvCell(fa),
          csvCell(row.buyer_email),
        ].join(","),
      );
    }

    lines.push(
      [
        csvCell("합계"),
        csvCell(""),
        csvCell(""),
        csvCell(""),
        csvCell(sumOrig),
        csvCell(sumDisc),
        csvCell(sumFinal),
        csvCell(`건수:${r.rows.length}`),
      ].join(","),
    );

    const csv = "\uFEFF" + lines.join("\r\n");
    const filename = `bongsim-coupon-report-${year}-${String(month).padStart(2, "0")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return NextResponse.json({ error: "tables_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupon-report/export]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
