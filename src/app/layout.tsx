import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

// 英數用 IBM Plex Sans（工程儀表感、數字清楚），中文用 Noto Sans TC
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// 中文字型檔很大，不預先載入，交給瀏覽器依實際用到的字分段下載
const notoTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  weight: ["400", "500", "700"],
  preload: false,
});

// 🔥 改這裡
export const metadata: Metadata = {
  title: "飲料開團通知系統",
  description: "貼上開團資訊、勾選名單，一鍵寄出 🚀",
  openGraph: {
    title: "飲料開團通知系統",
    description: "貼上開團資訊、勾選名單，一鍵寄出 🚀",
    url: "https://drink-mailer.vercel.app",
    siteName: "Drink Mailer",
    images: [
      {
        url: "https://drink-mailer.vercel.app/og-image.png", // 請放一張 1200x630 的圖到 public/ 下
        width: 1200,
        height: 630,
        alt: "飲料開團通知系統",
      },
    ],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "飲料開團通知系統",
    description: "貼上開團資訊、勾選名單，一鍵寄出 🚀",
    images: ["https://drink-mailer.vercel.app/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        // font-sans 要寫在這裡：字型變數定義在 body 上，寫在 html 層會解析不到而退回系統字型
        className={`${plex.variable} ${plexMono.variable} ${notoTC.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
