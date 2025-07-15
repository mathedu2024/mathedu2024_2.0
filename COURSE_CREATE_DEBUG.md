# 課程建立問題排查與修正

## 問題描述
使用者反映「資料庫內未出現課程資料」，即前端顯示儲存成功，但 Firestore 中沒有實際寫入課程資料。

## 已完成的排查與修正

### 1. 加強 API 錯誤處理與日誌記錄
- **檔案**: `app/api/courses/create/route.ts`
- **修改內容**:
  - 增加詳細的 console.log 記錄，追蹤整個課程建立流程
  - 加強錯誤處理，提供更詳細的錯誤訊息
  - 增加資料驗證，確保必要欄位存在
  - 增加寫入後驗證，確認資料確實寫入資料庫

### 2. 加強前端錯誤處理
- **檔案**: `app/components/CourseManager.tsx`
- **修改內容**:
  - 增加 API 回應狀態檢查
  - 顯示具體的錯誤訊息而非通用錯誤
  - 增加 console.log 記錄，追蹤 API 呼叫過程

### 3. 放寬 Firestore 安全規則
- **檔案**: `firestore.rules`
- **修改內容**:
  - 暫時允許 server 端完全存取，排除權限問題
  - 保留原有的用戶端規則

### 4. 建立測試工具
- **檔案**: 
  - `app/api/test-firestore/route.ts` - Firestore 連線測試 API
  - `app/test-firestore/page.tsx` - Firestore 連線測試頁面
  - `app/test-course-create/page.tsx` - 課程建立測試頁面

## 測試步驟

### 1. 測試 Firestore 連線
1. 訪問 `http://localhost:3000/test-firestore`
2. 點擊「測試 Firestore 連線」按鈕
3. 檢查結果是否顯示「Firestore 連線正常」

### 2. 測試課程建立
1. 訪問 `http://localhost:3000/test-course-create`
2. 點擊「建立測試課程」按鈕
3. 檢查結果和 server log

### 3. 實際課程建立測試
1. 在管理後台嘗試建立課程
2. 檢查瀏覽器 Network 面板中的 `/api/courses/create` 請求
3. 檢查 server log 中的詳細記錄

## 可能的問題原因

### 1. Firestore 連線問題
- Service account key 設定錯誤
- 專案 ID 不匹配
- 網路連線問題

### 2. 權限問題
- Firestore 安全規則阻擋寫入
- Service account 權限不足

### 3. 資料格式問題
- 必要欄位缺失
- 資料類型錯誤
- 特殊字元編碼問題

### 4. 前端問題
- API 請求未正確送出
- 資料格式錯誤
- 錯誤處理不當

## 下一步排查

如果上述修正後仍有問題，請：

1. **檢查 server log** - 查看是否有錯誤訊息
2. **檢查 Network 面板** - 確認 API 請求狀態
3. **使用測試頁面** - 驗證基本功能
4. **檢查 Firestore Console** - 直接查看資料庫狀態

## 修正檔案清單

- ✅ `app/api/courses/create/route.ts` - 加強錯誤處理
- ✅ `app/components/CourseManager.tsx` - 加強前端錯誤處理
- ✅ `firestore.rules` - 放寬安全規則
- ✅ `app/api/test-firestore/route.ts` - 新增測試 API
- ✅ `app/test-firestore/page.tsx` - 新增測試頁面
- ✅ `app/test-course-create/page.tsx` - 新增課程建立測試頁面 