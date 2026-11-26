import { JWT } from "google-auth-library";

/**
 * Google Sheets 存取（Service Account）。
 * 需要環境變數：
 *   GOOGLE_SERVICE_ACCOUNT_KEY  整份 service account JSON（與 Colab 的 GSPREAD_KEY 相同內容）
 *   SPREADSHEET_ID              試算表 ID
 */

const TZ = "Asia/Taipei";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export const SHEETS = {
  recipients: process.env.SHEET_RECIPIENTS || "Recipients",
  logs: process.env.SHEET_LOGS || "Logs",
  summary: process.env.SHEET_SUMMARY || "Summary",
  /** 明細分頁：預設依台北時間的年份決定，例如 RawData_2026 */
  rawData: () => process.env.SHEET_RAWDATA || `RawData_${taipeiParts(new Date()).year}`,
};

let cached: JWT | null = null;

function client(): JWT {
  if (cached) return cached;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("尚未設定環境變數 GOOGLE_SERVICE_ACCOUNT_KEY");
  const creds = parseKey(raw);
  if (!creds.client_email || !creds.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY 缺少 client_email 或 private_key");
  }
  cached = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return cached;
}

type Creds = { client_email?: string; private_key?: string };

/**
 * 解析金鑰。容許幾種常見貼法：整份 JSON（單行或多行）、外面多包一層引號、
 * private_key 內的 \n 被 .env 展開成真的換行、或整份 JSON 的 base64。
 * 錯誤訊息只回報長度與頭尾字元，不洩漏金鑰內容。
 */
function parseKey(raw: string): Creds {
  let s = raw.trim().replace(/^﻿/, "");
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"{') && s.endsWith('}"'))) s = s.slice(1, -1).trim();

  const candidates = [
    s,
    // private_key 字串內出現真的換行（JSON 不允許）→ 換回 \n
    s.replace(/("private_key"\s*:\s*")([\s\S]*?)("\s*[,}])/, (_m, a, b, c) => a + b.replace(/\r?\n/g, "\\n") + c),
  ];
  if (!s.startsWith("{")) {
    try {
      candidates.push(Buffer.from(s, "base64").toString("utf8"));
    } catch {
      /* 不是 base64 */
    }
  }
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === "object") return v as Creds;
    } catch {
      /* 試下一種 */
    }
  }
  const lines = s.split(/\r?\n/).length;
  throw new Error(
    `GOOGLE_SERVICE_ACCOUNT_KEY 不是有效的 JSON（長度 ${s.length}、${lines} 行、開頭「${s.slice(0, 1)}」、結尾「${s.slice(-1)}」）`
  );
}

function spreadsheetId(): string {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error("尚未設定環境變數 SPREADSHEET_ID");
  return id;
}

/** A1 範圍內的分頁名稱需要加單引號 */
function a1(sheet: string, range: string) {
  return `'${sheet.replace(/'/g, "''")}'!${range}`;
}

/** 讀取顯示值（保留 NT$ 等格式） */
export async function readRange(sheet: string, range: string): Promise<string[][]> {
  const url = `${API}/${spreadsheetId()}/values/${encodeURIComponent(a1(sheet, range))}?valueRenderOption=FORMATTED_VALUE`;
  const res = await client().request<{ values?: unknown[][] }>({ url });
  return (res.data.values || []).map((r) => r.map((c) => String(c ?? "")));
}

/** 在分頁尾端附加多列 */
export async function appendRows(sheet: string, range: string, rows: (string | number)[][]): Promise<void> {
  if (rows.length === 0) return;
  const url = `${API}/${spreadsheetId()}/values/${encodeURIComponent(a1(sheet, range))}:append?valueInputOption=USER_ENTERED`;
  await client().request({ url, method: "POST", data: { values: rows } });
}

/** 取得分頁的數字 ID（插入列需要） */
async function sheetGid(sheet: string): Promise<number> {
  const url = `${API}/${spreadsheetId()}?fields=sheets.properties(sheetId,title)`;
  const res = await client().request<{ sheets?: { properties?: { sheetId?: number; title?: string } }[] }>({ url });
  const hit = (res.data.sheets || []).find((s) => s.properties?.title === sheet);
  if (!hit || typeof hit.properties?.sheetId !== "number") throw new Error(`找不到工作表：${sheet}`);
  return hit.properties.sheetId;
}

/**
 * 把多列插入到標題列正下方（第 2 列起），讓最新資料在最上面。
 * 傳入的順序即為表上由上到下的順序。
 */
export async function insertRowsAtTop(sheet: string, rows: (string | number)[][]): Promise<void> {
  if (rows.length === 0) return;
  const gid = await sheetGid(sheet);
  const batchUrl = `${API}/${spreadsheetId()}:batchUpdate`;
  const dim = { sheetId: gid, dimension: "ROWS", startIndex: 1, endIndex: 1 + rows.length };

  // 先插入空白列；inheritFromBefore=false 表示格式沿用下方的資料列，而不是標題列
  await client().request({
    url: batchUrl,
    method: "POST",
    data: { requests: [{ insertDimension: { range: dim, inheritFromBefore: false } }] },
  });

  try {
    const width = Math.max(...rows.map((r) => r.length));
    const lastCol = String.fromCharCode(64 + width);
    const range = a1(sheet, `A2:${lastCol}${1 + rows.length}`);
    const url = `${API}/${spreadsheetId()}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await client().request({ url, method: "PUT", data: { values: rows } });
  } catch (e) {
    // 寫值失敗：把剛插入的空白列刪掉，避免帳本留下空列
    await client()
      .request({ url: batchUrl, method: "POST", data: { requests: [{ deleteDimension: { range: dim } }] } })
      .catch((e2) => console.error("rollback inserted rows failed", e2));
    throw e;
  }
}

/** 讀整張分頁並依第一列標題轉成物件陣列 */
export async function readTable(sheet: string): Promise<Record<string, string>[]> {
  const vals = await readRange(sheet, "A:Z");
  if (vals.length === 0) return [];
  const header = vals[0].map((h) => h.trim());
  return vals.slice(1).map((row) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = (row[i] ?? "").trim();
    });
    return o;
  });
}

/* ---------- 時間（一律以台北時間呈現；Vercel 主機是 UTC） ---------- */

export function taipeiParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** yyyy/MM/dd HH:mm */
export function fmtDateTime(d: Date) {
  const p = taipeiParts(d);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** MM/dd HH:mm */
export function fmtShort(d: Date) {
  const p = taipeiParts(d);
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** yyyy-MM-dd HH:mm（RawData「外拋時間」欄的格式） */
export function fmtRawStamp(d: Date) {
  const p = taipeiParts(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** yyyy/MM/dd HH:mm:ss（Logs 的 Time 欄） */
export function fmtLogStamp(d: Date) {
  const p = taipeiParts(d);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
