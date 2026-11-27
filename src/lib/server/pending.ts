import { SHEETS, readRange, taipeiParts } from "./sheets";

/**
 * 「已發開團通知、但還沒記帳」的比對。
 *
 * 來源：
 *   Logs     A=寄送時間 C=主旨（含「截止 MM/dd HH:mm」） D=店家 H=Status L=不用記帳的標記
 *   RawData  A=店名 B=寫入時間；同一次結單寫入的列有相同的 (店名, 時間)，視為一「批」
 *
 * 規則：每一次開團通知要配到一批「在通知之後、7 天內」寫入的記帳。
 * 先配店名相近的，再依時間先後配剩下的（通知信的店名常與你訂訂單上的寫法不同）。
 * 配不到、截止時間已過、且沒被標記「不用記」的，就是待記帳。
 */

export const DISMISS_COL = "L";
export const DISMISS_HEADER = "不用記帳";

const DAY = 24 * 60 * 60 * 1000;
/** 顯示最近幾天內的未記帳 */
const SHOW_DAYS = 14;
/** 為了避免較舊的通知把記帳批次「讓」給較新的通知，比對時往前多看一些 */
const MATCH_DAYS = 45;
/** 一次通知最晚幾天內記帳都算數 */
const SETTLE_WITHIN_DAYS = 7;

export type PendingItem = {
  /** Logs 的列號（1 起算） */
  row: number;
  /** Logs A 欄原始字串，標記「不用記」時用來確認列沒有跑掉 */
  time: string;
  vendor: string;
  /** 寄送日 MM/dd */
  sentDay: string;
  /** 截止時間 MM/dd HH:mm（解析不到時為空字串） */
  deadline: string;
  manager: string;
};

/**
 * 把試算表顯示的時間字串轉成「台北牆上時間」的毫秒數（當成 UTC 來算，只用於彼此比較）。
 * 容許 2026/11/27 14:03:22、2026-11-27 14:03、2026/11/27 下午 2:03:22 等寫法。
 */
export function parseWallTime(s: string): number | null {
  const m = String(s || "").match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:\D+?(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  let hour = m[4] ? Number(m[4]) : 0;
  if (/下午|PM/i.test(s) && hour < 12) hour += 12;
  if (/上午|AM/i.test(s) && hour === 12) hour = 0;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, m[5] ? Number(m[5]) : 0, m[6] ? Number(m[6]) : 0);
  return isNaN(t) ? null : t;
}

function wallNow(now: Date): number {
  const p = taipeiParts(now);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

const pad = (n: number) => String(n).padStart(2, "0");
const mmdd = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
};
const hhmm = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** 主旨「【飲料開團】店家 - 截止 MM/dd HH:mm」→ 截止時間；年份由寄送時間推得 */
function deadlineFromSubject(subject: string, sent: number): number | null {
  const m = String(subject || "").match(/截止\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const sentDate = new Date(sent);
  let year = sentDate.getUTCFullYear();
  // 年底發、隔年截止
  if (Number(m[1]) < sentDate.getUTCMonth() + 1 - 6) year += 1;
  return Date.UTC(year, Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]));
}

const normStore = (s: string) => String(s || "").toLowerCase().replace(/[\s\-_·・()（）【】\[\]]/g, "");
function similarStore(a: string, b: string) {
  const x = normStore(a);
  const y = normStore(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

export async function findPending(now = new Date()): Promise<PendingItem[]> {
  const nowT = wallNow(now);
  const [logs, raw] = await Promise.all([
    readRange(SHEETS.logs, `A2:${DISMISS_COL}`),
    readRange(SHEETS.rawData(), "A2:B"),
  ]);

  type Send = PendingItem & { sent: number; due: number; dismissed: boolean; settled: boolean };
  const byGroup = new Map<string, Send>();
  logs.forEach((r, i) => {
    const sent = parseWallTime(r[0]);
    const vendor = (r[3] || "").trim();
    if (sent === null || !vendor) return;
    if (nowT - sent > MATCH_DAYS * DAY) return;
    const status = (r[7] || "").trim();
    if (status && status.toLowerCase() !== "success") return;
    const deadline = deadlineFromSubject(r[2] || "", sent);
    const send: Send = {
      row: i + 2,
      time: r[0],
      vendor,
      sentDay: mmdd(sent),
      deadline: deadline === null ? "" : `${mmdd(deadline)} ${hhmm(deadline)}`,
      manager: (r[9] || "").trim(),
      sent,
      due: deadline ?? sent,
      dismissed: !!(r[11] || "").trim(),
      settled: false,
    };
    // 同一團重寄（同店家、同截止時間）只算一次；任何一封被標記不用記，整團都不用記
    const key = `${normStore(vendor)}|${send.deadline || send.sentDay}`;
    const prev = byGroup.get(key);
    if (prev) send.dismissed = send.dismissed || prev.dismissed;
    byGroup.set(key, send);
  });
  const sends = Array.from(byGroup.values()).sort((a, b) => a.sent - b.sent);

  // 記帳批次：同 (店名, 時間) 為一批
  const batchMap = new Map<string, { store: string; t: number; used: boolean }>();
  for (const r of raw) {
    const store = (r[0] || "").trim();
    const t = parseWallTime(r[1]);
    if (!store || t === null) continue;
    if (nowT - t > MATCH_DAYS * DAY) continue;
    batchMap.set(`${store}|${t}`, { store, t, used: false });
  }
  const batches = Array.from(batchMap.values()).sort((a, b) => a.t - b.t);

  // RawData 的時間只到分鐘，通知後同一分鐘內記帳也要算
  const inWindow = (s: Send, t: number) => t >= s.sent - 60 * 1000 && t <= s.sent + SETTLE_WITHIN_DAYS * DAY;
  const open = sends.filter((s) => !s.dismissed);
  for (const strict of [true, false]) {
    for (const s of open) {
      if (s.settled) continue;
      const hit = batches.find((b) => !b.used && inWindow(s, b.t) && (!strict || similarStore(s.vendor, b.store)));
      if (hit) {
        hit.used = true;
        s.settled = true;
      }
    }
  }

  return open
    .filter((s) => !s.settled && nowT > s.due && nowT - s.sent <= SHOW_DAYS * DAY)
    .sort((a, b) => b.sent - a.sent)
    .map(({ row, time, vendor, sentDay, deadline, manager }) => ({ row, time, vendor, sentDay, deadline, manager }));
}
