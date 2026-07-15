# Zeroflare Markdown 轉報告

將 Markdown 即時轉換為具備封面、目錄、頁首與頁碼的 A4 報告。

## 功能

- 左右分欄：左側編輯，右側 A4 預覽
- 封面自訂：標題、副標題、公司名稱、日期
- 自動從 `#` / `##` / `###` 產生目錄（全文通常只有一個 `#`）
- 內文頁首顯示標題／副標題；頁碼由內文起算（封面、目錄不計）
- 「匯出 PDF」／「匯出 Word」下載報告

## 開始使用

```bash
npm install
npm run dev
```

開啟終端機顯示的本地網址即可使用。

## 建置

```bash
npm run build
npm run preview
```

## 線上版（GitHub Pages）

推送到 `main` 後會自動建置並部署：

https://zeroflare.github.io/zeroflare-md2report/

倉庫設定：Settings → Pages → Source 選 **GitHub Actions**。
