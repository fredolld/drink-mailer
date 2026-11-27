import { NextRequest, NextResponse } from "next/server";
import { findPending } from "@/lib/server/pending";
import { esc, sendMail } from "@/lib/server/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = "https://drink-mailer.vercel.app";

/**
 * GET /api/cron/remind
 * 由 Vercel Cron 每天早上呼叫（見 vercel.json）；有未記帳的開團才寄提醒信。
 * 環境變數：
 *   CRON_SECRET  Vercel 會自動帶在 Authorization: Bearer <值>，用來擋掉外人呼叫
 *   REMIND_TO    提醒信收件人，多位以逗號分隔
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "尚未設定環境變數 CRON_SECRET" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  try {
    const to = (process.env.REMIND_TO || "").split(/[,;\s]+/).filter(Boolean);
    if (to.length === 0) throw new Error("尚未設定環境變數 REMIND_TO");

    const items = await findPending();
    if (items.length === 0) return NextResponse.json({ ok: true, sent: false, pending: 0 });

    const font = "font-family:Segoe UI, Noto Sans TC, Arial, sans-serif;";
    const td = "padding:6px 10px;border-bottom:1px solid #eee;";
    const rows = items
      .map(
        (i) =>
          `<tr><td style="${td}">${esc(i.sentDay)}</td><td style="${td}">${esc(i.vendor)}</td>` +
          `<td style="${td}">${esc(i.deadline || "—")}</td><td style="${td}">${esc(i.manager || "—")}</td></tr>`
      )
      .join("");
    const html =
      `<div style="${font}line-height:1.6;">` +
      `<h2>有 ${items.length} 團飲料還沒記帳</h2>` +
      `<p>以下開團已經寄出通知、也過了截止時間，但帳本裡找不到對應的記帳：</p>` +
      `<table style="border-collapse:collapse;${font}font-size:14px;">` +
      `<thead><tr><th align="left" style="${td}">通知日</th><th align="left" style="${td}">店家</th>` +
      `<th align="left" style="${td}">截止</th><th align="left" style="${td}">負責人</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>` +
      `<p><a href="${SITE}/?tab=settle">前往結單記帳</a></p>` +
      `<p style="font-size:12px;color:#888;">流團或測試信請在系統頂端的提醒列按「這團不用記」，之後就不會再提醒。此信由系統自動寄出。</p>` +
      `</div>`;

    await sendMail({ to, subject: `【飲料開團】有 ${items.length} 團尚未記帳`, html });
    return NextResponse.json({ ok: true, sent: true, pending: items.length });
  } catch (e) {
    console.error("GET /api/cron/remind", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
