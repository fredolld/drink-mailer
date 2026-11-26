/**
 * 解析「你訂」訂單頁回傳的 JSON，轉成要寫進 RawData 的明細。
 * 純函式，前後端都可以用。
 */

export const PLASTIC_ACCOUNT = "塑膠袋公費餘額";

export type OrderLine = {
  /** 你訂上的下單暱稱（塑膠袋為固定帳戶名） */
  contact: string;
  item: string;
  options: string;
  price: number;
  /** 塑膠袋：固定記到公費帳戶，不需要對應姓名 */
  isPlastic: boolean;
};

export type ParsedOrder = {
  orderId: string;
  storeName: string;
  orderTime: string;
  lines: OrderLine[];
  total: number;
  /** 你訂回報的訂單總額（未折抵），抓不到時為 null */
  expectedTotal: number | null;
  discount: number;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

function linesOf(contact: string, productSimple: unknown): OrderLine[] {
  const out: OrderLine[] = [];
  for (const raw of arr(productSimple)) {
    const it = obj(raw);
    if (num(it.is_disabled) === 1) continue;
    const item = str(it.name);
    if (!item) continue;
    const isPlastic = item === "塑膠袋";
    // amount 杯就寫 amount 列（price 是含加料的單價）
    const qty = Math.max(1, Math.round(num(it.actual_amount ?? it.amount) || 1));
    for (let i = 0; i < qty; i++) {
      out.push({
        contact: isPlastic ? PLASTIC_ACCOUNT : contact,
        item,
        options: str(it.additional_name),
        price: num(it.price),
        isPlastic,
      });
    }
  }
  return out;
}

/**
 * 接受整包回應 JSON，或只有 group_buy_follower_order_list 的陣列（舊 Colab 的貼法）。
 */
export function parseOrder(input: unknown): ParsedOrder {
  let data: unknown = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error("貼上的內容不是有效的 JSON");
    }
  }

  const root = Array.isArray(data) ? { group_buy_follower_order_list: data } : obj(data);
  const info = obj(root.order_info);
  const basic = obj(info.basic);
  const followers = arr(root.group_buy_follower_order_list);

  if (followers.length === 0 && Object.keys(basic).length === 0) {
    throw new Error("找不到訂單資料（需要 order_info 或 group_buy_follower_order_list）");
  }

  const lines: OrderLine[] = [];
  // 團主自己的品項與塑膠袋
  lines.push(...linesOf(str(basic.name), info.product_simple));
  // 跟團者
  for (const f of followers) {
    const o = obj(f);
    lines.push(...linesOf(str(o.contact_name), o.product_simple));
  }

  const storeName = [str(basic.brand_name), str(basic.store_name)].filter(Boolean).join(" ");
  const hasExpected = basic.total_money !== undefined && basic.total_money !== null;

  return {
    orderId: str(basic.order_id),
    storeName,
    orderTime: str(basic.order_time),
    lines,
    total: lines.reduce((s, l) => s + l.price, 0),
    expectedTotal: hasExpected ? num(basic.total_money) : null,
    discount: num(basic.total_discount_money),
  };
}

/** 姓名比對用：去空白、不分大小寫 */
export function normName(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}
