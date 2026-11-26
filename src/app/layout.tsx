import type { Metadata } from "next";
import "./globals.css";

// 字型：英數用 IBM Plex Sans（工程儀表感、數字清楚），中文用 Noto Sans TC。
// 刻意不用 next/font/google：它在建置時向 Google 下載字型檔，在 Vercel 上時好時壞會讓建置失敗。
// 改由瀏覽器在開頁時載入；載不到時會退回系統字型（微軟正黑體），不影響使用。
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_CSS} />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
