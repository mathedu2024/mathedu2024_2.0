# 建立測試帳號

## 統一用戶管理架構

本系統使用統一的 `users` 集合來管理所有用戶（學生、教師、管理員），提供更好的權限管理和資料一致性。

### 用戶角色說明
- **admin**: 系統管理員，擁有所有權限
- **teacher**: 教師，可以管理自己的課程和學生
- **student**: 學生，可以查看自己的課程和成績

### 用戶資料結構

#### 基礎欄位（所有用戶都有）
```typescript
{
  username: string;           // 登入用戶名（唯一）
  password: string;           // 密碼
  name: string;              // 顯示名稱
  role: 'admin' | 'teacher' | 'student';  // 用戶角色
  email?: string;            // 電子郵件
  phone?: string;            // 電話號碼
  isActive: boolean;         // 帳號是否啟用
  createdAt: string;         // 建立時間
  updatedAt: string;         // 更新時間
}
```

#### 管理員專用欄位
```typescript
{
  role: 'admin';
  permissions?: string[];    // 特殊權限列表
  note?: string;            // 備註
}
```

#### 教師專用欄位
```typescript
{
  role: 'teacher';
  courses?: string[];        // 授課課程列表
  subjects?: string[];       // 專長科目
  introduction?: string;     // 教師介紹
  avatarURL?: string;        // 頭像圖片網址
  experience?: string;       // 教學經驗
  education?: string;        // 學歷背景
}
```

#### 學生專用欄位
```typescript
{
  role: 'student';
  studentId: string;         // 學號
  grade: string;            // 年級
  class: string;            // 班級
  enrolledCourses?: string[]; // 已選課程列表
  parentName?: string;       // 家長姓名
  parentPhone?: string;      // 家長電話
  emergencyContact?: string; // 緊急聯絡人
}
```

## 方法一：使用 Firebase Console（推薦）

### 步驟 1：進入 Firebase Console
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇您的專案
3. 點擊左側選單的「Firestore Database」

### 步驟 2：建立 users 集合
1. 在 Firestore 中建立一個新的集合，名稱為 `users`
2. 在 `users` 集合中建立一個新的文件，文件 ID 為 `admin`
3. 添加以下欄位：

```json
{
  "username": "admin",
  "password": "admin123",
  "name": "系統管理員",
  "role": "admin",
  "email": "admin@school.edu.tw",
  "phone": "0912345678",
  "isActive": true,
  "permissions": ["user_management", "course_management", "system_settings"],
  "note": "主要系統管理員",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 方法二：使用 Firebase Admin SDK

如果您有 Firebase Admin SDK 設定，可以執行 `create-test-admin.js` 腳本：

```bash
# 安裝 Firebase Admin SDK
npm install firebase-admin

# 設定服務帳號金鑰
# 1. 在 Firebase Console 中前往「專案設定」>「服務帳號」
# 2. 點擊「產生新的私密金鑰」
# 3. 將金鑰檔案放在專案根目錄，並更新腳本中的路徑

# 執行腳本
node create-test-admin.js
```

## 測試帳號資訊

- **用戶名**: `admin`
- **密碼**: `admin123`
- **姓名**: 系統管理員
- **角色**: admin
- **登入網址**: `http://localhost:3000/panel`

## 登入步驟

1. 啟動您的 Next.js 開發伺服器：
   ```bash
   npm run dev
   ```

2. 前往 `http://localhost:3000/panel`

3. 使用以下資訊登入：
   - 用戶名：`admin`
   - 密碼：`admin123`

4. 登入成功後，您將進入後台管理面板，可以：
   - 管理學生資料
   - 管理課程
   - 管理教師帳號
   - 發布公告
   - 管理考試日期

## 建立其他測試帳號

### 建立教師帳號
在 `users` 集合中建立新文件，文件 ID 為教師用戶名：

```json
{
  "username": "teacher001",
  "password": "teacher123",
  "name": "吳其恩",
  "role": "teacher",
  "email": "teacher001@school.edu.tw",
  "phone": "0912345679",
  "isActive": true,
  "courses": ["數學基礎班(2024-MATH-001)", "進階數學班(2024-MATH-002)"],
  "subjects": ["數學", "微積分"],
  "introduction": "資深數學教師，專精於高中數學教學",
  "experience": "10年高中數學教學經驗",
  "education": "國立台灣大學數學系碩士",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 建立學生帳號
在 `users` 集合中建立新文件，文件 ID 為學生用戶名：

```json
{
  "username": "student001",
  "password": "student123",
  "name": "張小明",
  "role": "student",
  "email": "student001@school.edu.tw",
  "phone": "0912345680",
  "isActive": true,
  "studentId": "S001",
  "grade": "高一",
  "class": "1年1班",
  "enrolledCourses": ["數學基礎班(2024-MATH-001)"],
  "parentName": "張大明",
  "parentPhone": "0912345681",
  "emergencyContact": "張大明 0912345681",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 注意事項

⚠️ **安全提醒**：
- 這只是測試帳號，請在正式環境中更改密碼
- 建議在正式部署前移除或更改此測試帳號
- 實際應用中應該使用更安全的密碼加密方式

## 權限說明

### 管理員權限
- 用戶管理（新增、編輯、刪除所有用戶）
- 課程管理（新增、編輯、刪除所有課程）
- 系統設定（公告、考試日期等）
- 資料匯出與備份

### 教師權限
- 管理自己的課程內容
- 查看自己課程的學生名單
- 上傳成績和作業
- 管理輔導預約

### 學生權限
- 查看自己的課程
- 查看自己的成績
- 預約輔導
- 修改個人資料 