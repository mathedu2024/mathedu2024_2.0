# 老師課程同步功能

## 功能概述

本功能實現了管理員在更新課程資料時，自動同步更新老師的授課清單，讓老師能夠編輯課程資料。同時在刪除課程時，也會自動清除老師的編輯權限並從授課清單中移除。

## 功能特點

### 1. 自動同步
- **創建課程時**：自動將課程添加到指定老師的授課清單
- **更新課程時**：自動處理老師變更，從舊老師清單移除，添加到新老師清單
- **刪除課程時**：自動從所有相關老師的授課清單中移除

### 2. 資料一致性
- 確保老師的 `courses` 欄位與實際授課課程保持同步
- 避免手動維護造成的不一致問題
- 提供完整的操作日誌

## 技術實現

### API 端點

#### 1. 課程創建 API (`/api/courses/create`)
```typescript
POST /api/courses/create
{
  "name": "課程名稱",
  "code": "課程代碼",
  "teachers": ["teacherId1", "teacherId2"],
  // ... 其他課程資料
}
```

**功能**：
- 創建課程記錄
- 自動將課程添加到指定老師的授課清單

#### 2. 課程更新 API (`/api/courses/update`)
```typescript
POST /api/courses/update
{
  "id": "課程ID",
  "name": "課程名稱",
  "code": "課程代碼",
  "teachers": ["teacherId1", "teacherId2"],
  // ... 其他課程資料
}
```

**功能**：
- 更新課程記錄
- 比較舊老師和新老師清單
- 從不再擔任的老師清單中移除課程
- 為新老師添加課程到授課清單

#### 3. 課程刪除 API (`/api/courses/delete`)
```typescript
POST /api/courses/delete
{
  "id": "課程ID"
}
```

**功能**：
- 刪除課程記錄
- 自動從所有相關老師的授課清單中移除課程

#### 4. 老師課程更新 API (`/api/courses/update-teachers`)
```typescript
POST /api/courses/update-teachers
{
  "teacherIds": ["teacherId1", "teacherId2"],
  "courseName": "課程名稱",
  "courseCode": "課程代碼",
  "courseId": "課程ID",
  "isUpdate": true,
  "oldTeacherIds": ["oldTeacherId1"]
}
```

**功能**：
- 批量更新老師的授課清單
- 支援更新操作（移除舊老師，添加新老師）

#### 5. 從老師移除課程 API (`/api/courses/remove-from-teachers`)
```typescript
POST /api/courses/remove-from-teachers
{
  "courseId": "課程ID",
  "courseName": "課程名稱",
  "courseCode": "課程代碼",
  "teacherIds": ["teacherId1", "teacherId2"]
}
```

**功能**：
- 從指定老師的授課清單中移除課程

### 資料結構

#### 老師資料結構
```typescript
interface Teacher {
  id: string;
  username: string;
  name: string;
  role: 'teacher';
  courses: string[];  // 授課課程清單，格式：["課程名稱(課程代碼)"]
  // ... 其他欄位
}
```

#### 課程資料結構
```typescript
interface Course {
  id: string;
  name: string;
  code: string;
  teachers: string[];  // 老師ID清單
  teacherUids: string[];  // 老師UID清單
  // ... 其他欄位
}
```

## 使用流程

### 管理員操作流程

1. **創建課程**
   - 管理員在課程管理頁面創建新課程
   - 選擇授課老師
   - 系統自動將課程添加到老師的授課清單

2. **更新課程**
   - 管理員修改課程資料
   - 如果更換老師，系統自動處理老師清單變更
   - 原老師的授課清單會自動移除該課程
   - 新老師的授課清單會自動添加該課程

3. **刪除課程**
   - 管理員刪除課程
   - 系統自動從所有相關老師的授課清單中移除該課程

### 老師操作流程

1. **查看授課課程**
   - 老師登入後在「授課課程管理」頁面查看自己的課程
   - 課程清單會自動同步顯示

2. **編輯課程內容**
   - 老師可以編輯自己授課的課程內容
   - 系統會驗證老師是否有該課程的編輯權限

## 錯誤處理

### 常見錯誤情況

1. **老師不存在**
   - 系統會記錄錯誤日誌
   - 不會中斷整個操作流程
   - 其他老師的更新會正常進行

2. **課程資料不完整**
   - 系統會驗證必要欄位
   - 返回適當的錯誤訊息

3. **資料庫操作失敗**
   - 系統會記錄詳細錯誤資訊
   - 提供錯誤回饋給用戶

### 日誌記錄

所有操作都會記錄詳細的日誌：
```javascript
console.log('Added course 數學基礎班(2024-MATH-001) to teacher teacherId123');
console.log('Removed course 數學基礎班(2024-MATH-001) from teacher teacherId456');
```

## 測試

### 自動化測試

使用 `test-teacher-sync.js` 腳本進行功能測試：

```bash
node test-teacher-sync.js
```

測試內容包括：
1. 創建課程並驗證老師授課清單更新
2. 更新課程（更換老師）並驗證清單變更
3. 刪除課程並驗證清單清除
4. 清理測試資料

### 手動測試

1. **創建課程測試**
   - 以管理員身份登入
   - 創建新課程並指定老師
   - 檢查老師的授課清單是否更新

2. **更新課程測試**
   - 修改現有課程的老師
   - 檢查原老師和新老師的授課清單變更

3. **刪除課程測試**
   - 刪除課程
   - 檢查老師的授課清單是否清除

## 注意事項

### 資料一致性
- 課程的 `teachers` 欄位必須與老師的 `courses` 欄位保持同步
- 課程ID格式必須統一：`課程名稱(課程代碼)`

### 性能考量
- 批量操作時會逐個處理老師資料
- 大量老師時可能需要考慮批量更新優化

### 安全性
- 所有操作都需要適當的權限驗證
- 老師只能編輯自己授課的課程

## 未來改進

1. **批量操作優化**
   - 實現真正的批量更新以提高性能
   - 添加事務處理確保資料一致性

2. **通知功能**
   - 當課程變更時自動通知相關老師
   - 提供郵件或系統內通知

3. **權限細化**
   - 支援更細緻的課程編輯權限
   - 區分課程管理權限和內容編輯權限

4. **審計日誌**
   - 記錄所有課程變更的詳細歷史
   - 提供變更追蹤功能 