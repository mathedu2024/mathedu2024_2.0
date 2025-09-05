# Firebase 資料結構說明

## 概述
`StudentGradeViewer` 組件現在直接從 Firebase 讀取資料，不再使用模擬的 API 端點。

## 資料集合結構

### 1. `students` 集合
存儲學生基本資訊和選修課程。

```typescript
interface Student {
  id: string;                    // 學生 ID
  name: string;                  // 學生姓名
  email?: string;                // 學生郵箱
  enrolledCourses: string[];     // 選修的課程 ID 陣列
  // ... 其他學生資訊
}
```

**範例資料：**
```json
{
  "id": "student1",
  "name": "張小明",
  "email": "zhang@example.com",
  "enrolledCourses": ["course1", "course2", "course3"]
}
```

### 2. `courses` 集合
存儲課程基本資訊、成績設定和成績欄位定義。

```typescript
interface Course {
  id: string;                    // 課程 ID
  name: string;                  // 課程名稱
  code: string;                  // 課程代碼
  teacherName: string;           // 授課教師姓名
  gradeColumns: {                // 成績欄位定義
    [columnId: string]: {
      name: string;              // 欄位名稱（如：第一次小考）
      type: string;              // 欄位類型（如：小考成績、作業成績、上課態度）
      date: string;              // 日期（YYYY-MM-DD 格式）
    }
  };
  totalSetting: {                // 總成績計算設定
    regularDetail: {             // 平時成績詳細設定
      [typeName: string]: {      // 類型名稱（如：平時測驗、回家作業、上課態度）
        calcMethod: string;      // 計算方法（平均、最佳N次等）
        n?: number;              // 最佳N次中的N值
        percent: number;         // 權重百分比
      }
    };
    periodicEnabled: {           // 定期評量啟用設定
      [examName: string]: boolean; // 評量名稱：是否啟用
    };
    periodicPercent: number;     // 定期評量權重百分比
  };
  periodicScores: string[];      // 定期評量名稱陣列
}
```

**範例資料：**
```json
{
  "id": "course1",
  "name": "數學",
  "code": "MATH101",
  "teacherName": "李老師",
  "gradeColumns": {
    "col1": {
      "name": "第一次小考",
      "type": "小考成績",
      "date": "2024-01-15"
    },
    "col2": {
      "name": "第一次作業",
      "type": "作業成績",
      "date": "2024-01-20"
    },
    "col3": {
      "name": "上課參與度",
      "type": "上課態度",
      "date": "2024-01-30"
    }
  },
  "totalSetting": {
    "regularDetail": {
      "平時測驗": {
        "calcMethod": "平均",
        "percent": 40
      },
      "回家作業": {
        "calcMethod": "平均",
        "percent": 35
      },
      "上課態度": {
        "calcMethod": "平均",
        "percent": 25
      }
    },
    "periodicEnabled": {
      "第一次定期評量": true,
      "第二次定期評量": true,
      "期末評量": true
    },
    "periodicPercent": 60
  },
  "periodicScores": ["第一次定期評量", "第二次定期評量", "期末評量"]
}
```

### 3. `courseEnrollments` 集合
存儲學生選修課程的成績資料。

```typescript
interface CourseEnrollment {
  id: string;                    // 選修記錄 ID
  courseId: string;              // 課程 ID
  studentId: string;             // 學生 ID
  grades: {                      // 成績資料
    regular: {                   // 平時成績
      [columnId: string]: number; // 欄位 ID：分數
    };
    periodic: {                  // 定期評量成績
      [examName: string]: number; // 評量名稱：分數
    };
  };
  // ... 其他選修相關資訊
}
```

**範例資料：**
```json
{
  "id": "enrollment1",
  "courseId": "course1",
  "studentId": "student1",
  "grades": {
    "regular": {
      "col1": 85,
      "col2": 88,
      "col3": 95
    },
    "periodic": {
      "第一次定期評量": 87,
      "第二次定期評量": 89,
      "期末評量": 91
    }
  }
}
```

## 資料讀取流程

### 1. 載入學生課程
1. 從 `students/{studentId}` 讀取學生的 `enrolledCourses` 陣列
2. 根據課程 ID 陣列，從 `courses` 集合讀取每個課程的詳細資訊
3. 顯示課程選擇下拉選單

### 2. 載入課程成績
1. 從 `courses/{courseId}` 讀取課程的成績設定和欄位定義
2. 從 `courseEnrollments` 集合查詢該課程的所有學生選修記錄
3. 構建成績資料結構，包含所有學生的成績和統計資訊

## 權限設定

確保 Firebase 安全規則允許：
- 學生讀取自己的課程和成績資料
- 教師讀取所授課程的成績資料
- 管理員讀取所有資料

## 注意事項

1. **資料一致性**：確保 `students.enrolledCourses` 與 `courseEnrollments` 中的資料保持一致
2. **效能優化**：對於大量資料，考慮使用分頁或限制查詢結果數量
3. **錯誤處理**：妥善處理資料不存在或格式錯誤的情況
4. **快取策略**：考慮實作資料快取機制，減少 Firebase 讀取次數
