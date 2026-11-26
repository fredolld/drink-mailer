"use client";
import { useState } from "react";
import DrinkMailer from "@/components/DrinkMailer";
import SettleOrder from "@/components/SettleOrder";
import { Button } from "@/components/ui/button";

type Tab = "mail" | "settle";

export default function Page() {
  const [tab, setTab] = useState<Tab>("mail");
  return (
    <>
      <nav className="container mx-auto px-6 pt-6 flex gap-2" aria-label="功能切換">
        <Button variant={tab === "mail" ? "default" : "secondary"} onClick={() => setTab("mail")}>
          開團通知
        </Button>
        <Button variant={tab === "settle" ? "default" : "secondary"} onClick={() => setTab("settle")}>
          結單記帳
        </Button>
      </nav>
      {/* 兩個分頁都保持掛載，切換時不會丟失已填的內容 */}
      <div hidden={tab !== "mail"}>
        <DrinkMailer />
      </div>
      <div hidden={tab !== "settle"} className="container mx-auto p-6">
        <SettleOrder />
      </div>
    </>
  );
}
