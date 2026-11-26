import { NextRequest, NextResponse } from "next/server";
import { loadRecipients } from "@/lib/server/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/recipients?dept=xxx&keyword=yyy
export async function GET(req: NextRequest) {
  try {
    const dept = req.nextUrl.searchParams.get("dept") || "";
    const keyword = (req.nextUrl.searchParams.get("keyword") || "").toLowerCase();

    const all = await loadRecipients();
    const allDepts = Array.from(new Set(all.map((r) => r.dept).filter(Boolean))).sort();

    let list = all;
    if (dept && dept !== "ALL") list = list.filter((r) => r.dept === dept);
    if (keyword) list = list.filter((r) => (r.name + r.email + r.dept).toLowerCase().includes(keyword));

    return NextResponse.json({
      // 暱稱只供後端結單比對使用，不回傳給前端
      list: list.map(({ name, email, active, dept, phone, note }) => ({ name, email, active, dept, phone, note })),
      allDepts,
    });
  } catch (e) {
    console.error("GET /api/recipients", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
