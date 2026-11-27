import { NextRequest, NextResponse } from "next/server";
import { SHEETS, fmtDateTime, readRange, writeRange } from "@/lib/server/sheets";
import { DISMISS_COL, DISMISS_HEADER, findPending } from "@/lib/server/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pending → 已發通知但尚未記帳的開團
export async function GET() {
  try {
    return NextResponse.json({ ok: true, items: await findPending() });
  } catch (e) {
    console.error("GET /api/pending", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST /api/pending  body: { row, time } → 把這次通知標記為「不用記帳」（流團、測試信）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const row = Number(body?.row);
    const time = String(body?.time || "");
    if (!Number.isInteger(row) || row < 2 || !time) return fail("缺少 row 或 time");

    // 確認該列仍是同一筆紀錄，避免標記到別的列
    const cell = await readRange(SHEETS.logs, `A${row}`);
    if ((cell[0]?.[0] || "") !== time) return fail("紀錄已變動，請重新整理頁面後再試");

    const header = await readRange(SHEETS.logs, `${DISMISS_COL}1`);
    if (!(header[0]?.[0] || "").trim()) await writeRange(SHEETS.logs, `${DISMISS_COL}1`, [[DISMISS_HEADER]]);
    await writeRange(SHEETS.logs, `${DISMISS_COL}${row}`, [[`不用記（${fmtDateTime(new Date())}）`]]);

    return NextResponse.json({ ok: true, items: await findPending() });
  } catch (e) {
    console.error("POST /api/pending", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function fail(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
