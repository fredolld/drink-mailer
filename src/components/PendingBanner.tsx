"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { row: number; time: string; vendor: string; sentDay: string; deadline: string; manager: string };

/** 記帳寫入成功後由結單頁發出，讓提醒列重新比對 */
export const LEDGER_CHANGED = "drink:ledger-changed";

/** 已發開團通知但還沒記帳的提醒列 */
export default function PendingBanner({ onSettle }: { onSettle: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pending", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } catch {
      /* 提醒列讀不到不該擋住主要功能 */
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(LEDGER_CHANGED, load);
    return () => window.removeEventListener(LEDGER_CHANGED, load);
  }, [load]);

  async function dismiss(item: Item) {
    if (!window.confirm(`確定「${item.sentDay} ${item.vendor}」不用記帳嗎？（流團或測試信才需要按）`)) return;
    setBusyRow(item.row);
    setError("");
    try {
      const res = await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: item.row, time: item.time }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "標記失敗");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "標記失敗");
    } finally {
      setBusyRow(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div role="status" className="border-b border-signal/40 bg-signal/15">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full bg-signal" aria-hidden />
          有 {items.length} 團已發通知、尚未記帳
        </p>
        <ul className="mt-2 space-y-2">
          {items.map((i) => (
            <li key={i.row} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="min-w-0 flex-1 basis-56">
                <span className="tabular-nums">{i.sentDay}</span> <span className="font-medium">{i.vendor}</span>
                {i.deadline && <span className="text-muted-foreground">（截止 {i.deadline}）</span>}
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={onSettle}>
                  去記帳
                </Button>
                <Button size="sm" variant="outline" className="bg-card" disabled={busyRow === i.row} onClick={() => dismiss(i)}>
                  {busyRow === i.row ? "處理中…" : "這團不用記"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
