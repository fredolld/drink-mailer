import { NextRequest, NextResponse } from "next/server";
import { SHEETS, appendRows, fmtLogStamp, fmtShort, readRange } from "@/lib/server/sheets";
import { buildMailHtml, mailFrom, sendMail } from "@/lib/server/mail";
import { loadRecipients } from "@/lib/server/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/send-mail   body: { payload: {...} }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const p = (body && body.payload) || {};

    const vendor = String(p.vendor || "").trim();
    const link = String(p.link || "").trim();
    const note = String(p.note || "");
    const managerName = String(p.managerName || "");
    const managerPhone = String(p.managerPhone || "");
    const deadline = new Date(p.deadline);

    if (!vendor) return fail("缺少店家名稱");
    if (!/^https?:\/\//i.test(link)) return fail("訂購連結需為 http(s) 網址");
    if (isNaN(deadline.getTime())) return fail("訂購截止時間格式錯誤");

    // 只允許寄給 Recipients 表內的信箱，避免這支 API 被拿去寄給任意對象
    const known = new Map((await loadRecipients()).map((r) => [r.email.toLowerCase(), r.email]));
    const requested: string[] = Array.isArray(p.emails) ? p.emails.map(String) : [];
    const emails = Array.from(
      new Set(requested.map((e) => known.get(e.trim().toLowerCase())).filter((e): e is string => !!e))
    );
    if (emails.length === 0) return fail("沒有有效的收件人（需為 Recipients 表內的信箱）");

    // Summary：A=姓名、C=剩餘金額（保留顯示格式）
    const summary = await readRange(SHEETS.summary, "A2:C");
    const balances = summary
      .map((r) => ({ name: (r[0] || "").trim(), bal: (r[2] || "").trim() }))
      .filter((o) => o.name);

    const subject = `【飲料開團】${vendor} - 截止 ${fmtShort(deadline)}`;
    const html = buildMailHtml({ vendor, link, deadline, managerName, note, balances });

    const from = mailFrom();
    if (p.bccMode) await sendMail({ to: [from], bcc: emails, subject, html });
    else await sendMail({ to: emails, subject, html });

    // 信已寄出；紀錄失敗不應讓使用者以為沒寄而重寄
    let logWarning = "";
    try {
      await appendRows(SHEETS.logs, "A:K", [
        [fmtLogStamp(new Date()), from, subject, vendor, link, emails.length, emails.join(";"), "Success", "bulk-all-summary", managerName, managerPhone],
      ]);
    } catch (e) {
      console.error("append Logs failed", e);
      logWarning = "（但寫入 Logs 失敗）";
    }

    return NextResponse.json({ ok: true, message: `寄送成功！共 ${emails.length} 位${logWarning}` });
  } catch (e) {
    console.error("POST /api/send-mail", e);
    return NextResponse.json({ ok: false, message: "寄送失敗：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

function fail(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
