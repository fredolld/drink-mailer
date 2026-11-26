# 飲料開團通知系統（drink-mailer）

Next.js 單一專案，前後端都在這裡，部署在 Vercel。資料存在 Google 試算表。

## 功能

| 分頁 | 做什麼 | API |
|---|---|---|
| 開團通知 | 勾選收件人，寄出開團通知信（附全體剩餘金額一覽），並寫一筆 `Logs` | `GET /api/recipients`、`POST /api/send-mail` |
| 結單記帳 | 貼上「你訂」訂單頁的回應 JSON，預覽後寫入 `RawData_<年份>` | `POST /api/orders` |

原本的 Google Apps Script 與 Colab 筆記本已由上面的 API 取代。`apps-script-backend.gs` 僅留作舊版參考。

## 結單記帳的規則

- 整包 JSON 貼上即可；店名取 `brand_name + store_name`。
- 每杯一列，價格為含加料的單價；塑膠袋記到「塑膠袋公費餘額」。
- 新資料插在標題列正下方（第 2 列起），最新的訂單在最上面。
- 下單暱稱會跟 `Summary` A 欄的姓名比對（不分大小寫）。對不到的要在預覽表內手動指定，否則不能寫入。
- 同一家店同一天已有紀錄時會警告，需勾選「仍要寫入」才會再寫。
- 折抵金額不分攤，明細照原價記。

## 環境變數

見 `.env.example`。本機開發複製成 `.env.local`；正式環境在 Vercel 專案的 Environment Variables 設定。

service account 需要對試算表有「編輯者」權限（沿用 Colab 那一個即可）。

## 開發

```bash
npm install
npm run dev
```

## 注意

- API 沒有登入保護，知道網址的人都能呼叫。寄信對象已限制為 `Recipients` 表內的信箱。
- 公司 SMTP 若只開放內網或固定 IP，Vercel 會連不上，需改用可從外網連線的 SMTP。
