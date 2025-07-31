# React Starter

這是一個使用 React.js + Next.js 建立的示範空白專案。

利用終端機 Terminal 執行以下指令開啟專案。

1. 安裝套件
```
npm install
```

2. 啟動開發伺服器
```
npm run dev
```

3. 開啟網頁預覽網址
```
http://localhost:3000
```
npm run build
--------
##把code推到github
1. git init
2. git add .
3. git commit -m "ver1.6.1"
4. git branch -M main
5. git remote add origin https://github.com/mathedu2024/mathedu2024_2.0.git
6. git push -u origin main

## 專案結構

```
.
├── app/                  # 主要的應用程式原始碼 (Next.js App Router)
│   ├── api/              # API 接口 (後端邏輯)
│   │   ├── panel/        # (可能是管理員/老師後台相關的 API)
│   │   └── upload-image/ # 處理圖片上傳的 API
│   ├── components/       # 可重複使用的 React 元件 (如對話框、管理工具、導覽列)
│   ├── config/           # 設定檔 (例如，使用者驗證邏輯)
│   ├── courses/          # 公開的課程介紹頁面
│   ├── fqa/              # "常見問題" 頁面
│   ├── student/          # 學生專用的頁面
│   ├── teacher/          # 老師專用的頁面
│   ├── back-login/       # 後台登入頁面 (給老師/管理員)
│   ├── back-panel/       # 後台儀表板 (給老師/管理員)
│   ├── login/            # 學生登入頁面
│   ├── panel/            # (可能是舊版的後台或重新導向頁面)
│   ├── layout.tsx        # 網站的根佈局檔案
│   ├── page.tsx          # 網站首頁
│   └── globals.css       # 全域 CSS 樣式
│
├── public/               # 靜態資源 (如圖片、圖示)
│   ├── 老師介紹/         # 存放老師介紹的圖片
│   └── 課程介紹圖片/       # 存放課程介紹的封面圖片
│
├── services/             # 後端服務整合
│   ├── announcementService.ts # 處理公告相關的邏輯
│   ├── authService.ts    # 使用者驗證邏輯
│   ├── cloudinary.ts     # Cloudinary SDK 設定與相關函式
│   ├── examService.ts    # 處理考試相關的邏輯
│   └── firebase.ts       # Firebase SDK 初始化設定
│
├── middleware.ts         # Next.js 中介層，用於處理請求 (例如，權限驗證)
├── next.config.ts        # Next.js 設定檔
├── tailwind.config.js    # Tailwind CSS 設定檔
├── tsconfig.json         # TypeScript 設定檔
└── package.json          # 專案依賴與腳本設定