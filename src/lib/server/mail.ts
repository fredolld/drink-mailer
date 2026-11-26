import nodemailer from "nodemailer";
import { fmtDateTime } from "./sheets";

/**
 * 寄信（SMTP）。環境變數：
 *   SMTP_HOST, SMTP_PORT（預設 587）, SMTP_SECURE（"true" 表示 465/SSL）
 *   SMTP_USER, SMTP_PASS（若伺服器不需驗證可留空）
 *   MAIL_FROM   寄件者，例如  飲料開團 <someone@example.com>
 */
function transporter() {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("尚未設定環境變數 SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

export function mailFrom(): string {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("尚未設定環境變數 MAIL_FROM");
  return from;
}

export async function sendMail(opts: { to: string[]; bcc?: string[]; subject: string; html: string }) {
  await transporter().sendMail({
    from: mailFrom(),
    to: opts.to.join(","),
    bcc: opts.bcc && opts.bcc.length ? opts.bcc.join(",") : undefined,
    subject: opts.subject,
    html: opts.html,
  });
}

/* ---------- 信件內容（沿用原 Apps Script 的版型） ---------- */

const TABLE_W = 420;
const NAME_W = 168;
const AMT_W = 252;

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string)
  );
}

/** 判斷像 "NT$485"、"-NT$215" 這種顯示字串是否為負數 */
export function isNegativeDisplay(s: string) {
  const t = String(s || "").replace(/−/g, "-").replace(/[^\d.\-]/g, "");
  if (!t) return false;
  const n = Number(t);
  return isFinite(n) && n < 0;
}

export type Balance = { name: string; bal: string };

export function buildMailHtml(p: {
  vendor: string;
  link: string;
  deadline: Date;
  managerName?: string;
  note?: string;
  balances: Balance[];
}) {
  const font = "font-family:Segoe UI, Noto Sans TC, Arial, sans-serif;";
  let html =
    `<div style="${font} line-height:1.6;">` +
    `<h2>飲料開團通知：${esc(p.vendor)}</h2>` +
    `<p><b>訂購連結：</b> <a href="${esc(p.link)}">${esc(p.link)}</a></p>` +
    `<p><b>訂購截止：</b> ${fmtDateTime(p.deadline)}</p>` +
    (p.managerName ? `<p><b>今日飲料負責人：</b> ${esc(p.managerName)}</p>` : "") +
    (p.note ? `<p><b>備註：</b> ${esc(p.note)}</p>` : "") +
    `</div>`;

  const head =
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${TABLE_W}" style="width:${TABLE_W}px;max-width:${TABLE_W}px;margin:8px 0;"><tr><td>` +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${TABLE_W}" style="width:${TABLE_W}px;border-collapse:collapse;table-layout:fixed;${font}font-size:14px;line-height:1.4;">` +
    `<thead><tr>` +
    `<th align="left" width="${NAME_W}" style="width:${NAME_W}px;border-bottom:1px solid #ddd;padding:4px 8px;">姓名</th>` +
    `<th align="right" width="${AMT_W}" style="width:${AMT_W}px;border-bottom:1px solid #ddd;padding:4px 8px;border-left:1px solid #eee;">剩餘金額</th>` +
    `</tr></thead><tbody>`;

  const rows = p.balances
    .map((r, i) => {
      const neg = isNegativeDisplay(r.bal);
      const bg = neg ? "#fff5f5" : i % 2 === 1 ? "#f5f7fa" : "#ffffff";
      return (
        `<tr>` +
        `<td width="${NAME_W}" style="width:${NAME_W}px;padding:4px 8px;border-bottom:1px solid #f0f0f0;background:${bg};">${esc(r.name)}</td>` +
        `<td width="${AMT_W}" style="width:${AMT_W}px;padding:4px 8px;border-bottom:1px solid #f0f0f0;background:${bg};text-align:right;border-left:1px solid #eee;font-variant-numeric:tabular-nums;">` +
        `<span style="${neg ? "color:#d32f2f;font-weight:600;" : ""}">${esc(r.bal)}</span>` +
        `</td></tr>`
      );
    })
    .join("");

  html +=
    `<div style="margin-top:12px;"><p><b>全體剩餘金額一覽：</b></p>${head}${rows}</tbody></table></td></tr></table></div>` +
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td style="height:1px;line-height:1px;font-size:1px;"></td></tr></table>` +
    `<div style="margin-top:12px;"><hr style="border:none;border-top:1px solid #ccc;margin:12px 0;" />` +
    `<p style="font-size:12px;color:#888;${font}">此信由系統自動寄出，請勿回覆。</p></div>`;

  return html;
}
