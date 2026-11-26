import { NextRequest, NextResponse } from "next/server";
import { SHEETS, appendRows, fmtRawStamp, readRange } from "@/lib/server/sheets";
import { loadRecipients } from "@/lib/server/recipients";
import { PLASTIC_ACCOUNT, normName, parseOrder } from "@/lib/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/orders
 * body: {
 *   json: string | object      你訂訂單頁的回應 JSON
 *   nameMap?: { [下單暱稱]: 帳本姓名 }   手動指定的對應
 *   confirm?: boolean          false/省略 = 只預覽；true = 寫入 RawData
 *   force?: boolean            已偵測到同店同日紀錄時仍要寫入
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.json === undefined) return fail("缺少 json");

    let order;
    try {
      order = parseOrder(body.json);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    if (order.lines.length === 0) return fail("訂單內沒有任何品項");

    const nameMap: Record<string, string> = body.nameMap && typeof body.nameMap === "object" ? body.nameMap : {};
    const rawSheet = SHEETS.rawData();

    const [summaryCol, recipients, rawAB] = await Promise.all([
      readRange(SHEETS.summary, "A2:A"),
      loadRecipients().catch(() => []),
      readRange(rawSheet, "A2:B"),
    ]);

    // 帳本姓名（Summary A 欄），比對時不分大小寫
    const summaryNames = summaryCol.map((r) => (r[0] || "").trim()).filter(Boolean);
    const canonical = new Map(summaryNames.map((n) => [normName(n), n]));
    // Recipients 的「你訂暱稱」→ 本名，僅當作提示
    const nickToReal = new Map(recipients.filter((r) => r.nickname).map((r) => [normName(r.nickname), r.name]));

    const now = new Date();
    const stamp = fmtRawStamp(now);
    const day = (order.orderTime || stamp).slice(0, 10);
    const storeName = order.storeName || String(body.storeName || "").trim();

    const lines = order.lines.map((l) => {
      let name: string | null;
      if (l.isPlastic) name = PLASTIC_ACCOUNT;
      else if (typeof nameMap[l.contact] === "string" && nameMap[l.contact].trim()) name = nameMap[l.contact].trim();
      else name = canonical.get(normName(l.contact)) ?? null;
      return { ...l, name, hint: l.isPlastic ? "" : nickToReal.get(normName(l.contact)) || "" };
    });

    const unmatched = Array.from(new Set(lines.filter((l) => !l.name).map((l) => l.contact)));
    // 同一家店、同一天已經有紀錄 → 可能重複寫入
    const duplicateCount = storeName
      ? rawAB.filter((r) => (r[0] || "").trim() === storeName && (r[1] || "").startsWith(day)).length
      : 0;

    const preview = {
      ok: true,
      written: false,
      sheet: rawSheet,
      orderId: order.orderId,
      storeName,
      orderTime: order.orderTime,
      lines,
      total: order.total,
      expectedTotal: order.expectedTotal,
      discount: order.discount,
      unmatched,
      summaryNames,
      duplicateCount,
    };

    if (!body.confirm) return NextResponse.json(preview);

    if (!storeName) return fail("JSON 內沒有店名，請手動填寫店名");
    if (unmatched.length > 0) return fail("還有未對應的姓名：" + unmatched.join("、"));
    if (duplicateCount > 0 && !body.force) {
      return fail(`${rawSheet} 已有 ${duplicateCount} 筆「${storeName}」在 ${day} 的紀錄，疑似重複。確定要再寫一次請勾選「仍要寫入」。`);
    }

    // 欄位：店名 / 外拋時間 / 訂購人姓名 / 品項 / 客製 / 價格
    const rows = lines.map((l) => [storeName, stamp, l.name as string, l.item, l.options, l.price]);
    await appendRows(rawSheet, "A:F", rows);

    return NextResponse.json({ ...preview, written: true, message: `已寫入 ${rows.length} 筆到 ${rawSheet}，合計 NT$${order.total}` });
  } catch (e) {
    console.error("POST /api/orders", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function fail(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
