# Cloudinary 整合設定說明

## 1. 註冊 Cloudinary 帳號
1. 前往 [Cloudinary](https://cloudinary.com/) 註冊免費帳號
2. 登入後進入 Dashboard

## 2. 取得 API 憑證
在 Cloudinary Dashboard 中，你可以找到以下資訊：
- **Cloud Name**: 你的雲端名稱
- **API Key**: API 金鑰
- **API Secret**: API 密鑰

## 3. 設定環境變數
在專案根目錄創建 `.env.local` 檔案，並加入以下內容：

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Next.js Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your-api-key
```

請將 `your-cloud-name`、`your-api-key`、`your-api-secret` 替換為你的實際 Cloudinary 憑證。

## 4. 功能特色

### 圖片上傳
- 支援 JPG、PNG、GIF 等常見圖片格式
- 自動調整圖片尺寸為 800x600
- 自動優化圖片品質和格式
- 檔案大小限制為 5MB

### 圖片管理
- 圖片會儲存在 `course-covers` 資料夾中
- 刪除課程時會自動刪除相關圖片
- 支援圖片預覽和編輯

### 安全性
- API Secret 只在伺服器端使用
- 檔案類型驗證
- 檔案大小限制

## 5. 使用方式
1. 在課程管理頁面新增或編輯課程
2. 點擊「選擇檔案」上傳課程封面圖片
3. 圖片會自動上傳到 Cloudinary 並顯示預覽
4. 儲存課程後，圖片 URL 會儲存在資料庫中

## 6. 注意事項
- 確保 `.env.local` 檔案已加入 `.gitignore`
- 不要將 API Secret 暴露在客戶端程式碼中
- 定期檢查 Cloudinary 的使用量（免費版有使用限制）

## 7. 故障排除
如果遇到上傳問題：
1. 檢查環境變數是否正確設定
2. 確認網路連線正常
3. 檢查 Cloudinary 帳號狀態
4. 查看瀏覽器開發者工具的錯誤訊息 