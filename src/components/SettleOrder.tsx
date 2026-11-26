"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClipboardPaste, Eye, Save } from "lucide-react";

const ORDERS_API = "/api/orders";

type Line = {
  contact: string;
  item: string;
  options: string;
  price: number;
  isPlastic: boolean;
  name: string | null;
  hint: string;
};

type Preview = {
  ok: boolean;
  message?: string;
  written?: boolean;
  sheet: string;
  orderId: string;
  storeName: string;
  orderTime: string;
  lines: Line[];
  total: number;
  expectedTotal: number | null;
  discount: number;
  unmatched: string[];
  summaryNames: string[];
  duplicateCount: number;
};

const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function SettleOrder() {
  const [json, setJson] = useState("");
  const [storeName, setStoreName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  // 下單暱稱 → 帳本姓名（只放使用者手動指定的）
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function call(confirm: boolean, map = nameMap) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(ORDERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, nameMap: map, storeName, confirm, force }),
      });
      const data: Preview = await res.json();
      if (!data.ok) throw new Error(data.message || "處理失敗");
      setPreview(data);
      if (data.written) {
        setMessage({ text: data.message || "已寫入", ok: true });
        setJson("");
        setForce(false);
      }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "處理失敗", ok: false });
    } finally {
      setBusy(false);
    }
  }

  function onPreview() {
    setNameMap({});
    setForce(false);
    setPreview(null);
    call(false, {});
  }

  function pick(contact: string, value: string) {
    const next = { ...nameMap, [contact]: value };
    if (!value) delete next[contact];
    setNameMap(next);
  }

  // 畫面上每一列實際會寫入的姓名
  const resolved = (l: Line) => (l.isPlastic ? l.name : nameMap[l.contact] || l.name);
  const stillUnmatched = useMemo(
    () => (preview ? Array.from(new Set(preview.lines.filter((l) => !resolved(l)).map((l) => l.contact))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, nameMap]
  );

  const done = !!preview?.written;
  const totalOk = preview ? preview.expectedTotal === null || preview.expectedTotal === preview.total : true;
  const needStore = !!preview && !preview.storeName && !storeName.trim();
  const canWrite =
    !!preview && !done && !busy && stillUnmatched.length === 0 && !needStore && (preview.duplicateCount === 0 || force);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>結單記帳</CardTitle>
        <CardDescription>
          飲料結單後，把「你訂」訂單頁的回應 JSON 整包貼上，確認預覽無誤再寫入試算表。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="order-json">訂單 JSON</Label>
          <Textarea
            id="order-json"
            className="h-40 font-mono text-xs"
            placeholder='{ "status": 200, "order_info": { ... }, "group_buy_follower_order_list": [ ... ] }'
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setPreview(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            貼整包即可；只貼 group_buy_follower_order_list 陣列也可以，但那樣不含店名與塑膠袋。
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" disabled={busy || !json.trim()} onClick={onPreview}>
            {preview ? <Eye className="mr-2 h-4 w-4" /> : <ClipboardPaste className="mr-2 h-4 w-4" />}
            {busy && !preview ? "解析中…" : "預覽"}
          </Button>
          {message && (
            <div className={cn("text-sm", message.ok ? "text-green-600" : "text-red-600")}>{message.text}</div>
          )}
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{preview.storeName || "（無店名）"}</Badge>
              {preview.orderId && <span className="text-muted-foreground">訂單 {preview.orderId}</span>}
              {preview.orderTime && <span className="text-muted-foreground">結單 {preview.orderTime}</span>}
              <span className="text-muted-foreground">→ 寫入 {preview.sheet}</span>
            </div>

            {!preview.storeName && !done && (
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="store">店名 *</Label>
                <Input
                  id="store"
                  placeholder="迷客夏 桃園內壢忠孝店"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onBlur={() => storeName.trim() && call(false)}
                />
              </div>
            )}

            <div className="border rounded-2xl p-2 max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1">下單暱稱</th>
                    <th className="text-left">記帳姓名</th>
                    <th className="text-left">品項</th>
                    <th className="text-left">客製</th>
                    <th className="text-right pr-2">價格</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l, i) => {
                    const auto = l.isPlastic || !!l.name;
                    return (
                      <tr key={i} className={cn("border-t", !resolved(l) && "bg-red-50")}>
                        <td className="py-2">
                          {l.isPlastic ? <span className="text-muted-foreground">—</span> : l.contact || "（空白）"}
                          {l.hint && <span className="ml-1 text-xs text-muted-foreground">（{l.hint}）</span>}
                        </td>
                        <td className="py-2">
                          {auto || done ? (
                            resolved(l)
                          ) : (
                            <select
                              className={selectCls}
                              value={nameMap[l.contact] || ""}
                              onChange={(e) => pick(l.contact, e.target.value)}
                              aria-label={`${l.contact} 的記帳姓名`}
                            >
                              <option value="">請選擇…</option>
                              {l.contact && <option value={l.contact}>保留原名「{l.contact}」</option>}
                              {preview.summaryNames.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-2">{l.item}</td>
                        <td className="py-2 text-muted-foreground">{l.options}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{l.price}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="py-2" colSpan={4}>合計（{preview.lines.length} 筆）</td>
                    <td className="py-2 pr-2 text-right tabular-nums">NT${preview.total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="space-y-1 text-sm">
              {preview.expectedTotal !== null && (
                <li className={totalOk ? "text-green-600" : "text-red-600"}>
                  {totalOk
                    ? `合計與你訂的訂單總額相符（NT$${preview.expectedTotal}）`
                    : `合計 NT$${preview.total} 與你訂的訂單總額 NT$${preview.expectedTotal} 不符，請檢查`}
                </li>
              )}
              {preview.discount > 0 && (
                <li className="text-muted-foreground">
                  這張單有折抵 NT${preview.discount}；明細照原價記帳，折抵未分攤。
                </li>
              )}
              {stillUnmatched.length > 0 && !done && (
                <li className="text-red-600">
                  以下暱稱在 Summary 找不到對應姓名，請在表格內指定：{stillUnmatched.join("、")}
                </li>
              )}
              {preview.duplicateCount > 0 && !done && (
                <li className="text-amber-600">
                  {preview.sheet} 已有 {preview.duplicateCount} 筆這家店同一天的紀錄，可能已經記過帳。
                </li>
              )}
            </ul>

            {!done && (
              <div className="flex items-center gap-4 flex-wrap">
                {preview.duplicateCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="force" checked={force} onCheckedChange={(v) => setForce(!!v)} />
                    <Label htmlFor="force">仍要寫入</Label>
                  </div>
                )}
                <Button disabled={!canWrite} onClick={() => call(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  {busy ? "寫入中…" : `確認寫入 ${preview.lines.length} 筆`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
