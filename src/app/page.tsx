"use client";
import { useEffect, useState } from "react";
import DrinkMailer from "@/components/DrinkMailer";
import SettleOrder from "@/components/SettleOrder";
import PendingBanner from "@/components/PendingBanner";
import { cn } from "@/lib/utils";
import { CupSoda } from "lucide-react";

type Tab = "mail" | "settle";

const TABS: { id: Tab; label: string }[] = [
  { id: "mail", label: "開團通知" },
  { id: "settle", label: "結單記帳" },
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("mail");
  // 網址帶 ?tab=settle 時直接開結單頁（一鍵書籤會用到）
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "settle") setTab("settle");
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-8 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 font-semibold tracking-tight">
            <CupSoda className="h-5 w-5 text-signal" aria-hidden />
            飲料開團
          </div>
          <nav className="flex items-stretch" role="tablist" aria-label="功能切換">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "border-b-2 px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                  tab === t.id
                    ? "border-signal font-medium text-white"
                    : "border-transparent text-white/65 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto hidden items-center text-xs text-white/55 sm:flex">華城電機 資訊中心</div>
        </div>
      </header>

      <PendingBanner onSettle={() => setTab("settle")} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* 兩個分頁都保持掛載，切換時不會丟失已填的內容 */}
        <div hidden={tab !== "mail"}>
          <DrinkMailer />
        </div>
        <div hidden={tab !== "settle"}>
          <SettleOrder />
        </div>
      </main>

      <footer className={cn("border-t py-4 text-center text-xs text-muted-foreground", tab === "mail" && "mb-20")}>
        © {new Date().getFullYear()} 華城 資訊中心-李承翰
      </footer>
    </div>
  );
}
