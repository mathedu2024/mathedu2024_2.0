# 學生預約輔導故障排除指南

## 問題描述
學生在預約輔導時，雖然看到有符合的時段，但無法申請。

## 常見問題

### 1. 查看有輔導的日期無顯示可申請時段

**症狀：** 學生在月曆中看到某些日期有時段指示，但點擊後沒有顯示可申請的時段

**原因：**
- Calendar 組件在學生模式下只獲取選中日期的時段，而不是整個月份的時段
- 時段指示器顯示邏輯與實際時段獲取邏輯不一致
- 學生模式下時段過濾邏輯有問題

**解決方案：**
- 修復 Calendar 組件，讓學生模式下獲取整個月份的時段
- 改進時段指示器顯示邏輯
- 確保時段過濾邏輯正確

**檢查方法：**
```javascript
// 檢查特定日期的時段
const q = query(
  collection(db, 'time-slots'),
  where('date', '==', '2024-01-15'),
  where('status', '==', 'available')
);
const snapshot = await getDocs(q);
console.log('該日期的時段:', snapshot.docs.map(doc => doc.data()));
```

### 2. 學生沒有選修課程
**症狀：** 學生課程數為 0，所有時段都顯示資格不符合

**原因：**
- 學生資料中的 `enrolledCourses` 欄位為空或不存在
- 學生尚未選修任何課程

**解決方案：**
- 檢查學生資料文檔中的 `enrolledCourses` 欄位
- 確保學生已正確選修課程
- 在管理後台為學生添加課程

**檢查方法：**
```javascript
// 在瀏覽器控制台執行
const studentDoc = await getDocs(query(collection(db, 'student_data'), where('account', '==', '學生帳號')));
console.log('學生資料:', studentDoc.docs[0].data());
```

### 3. 課程資料不完整
**症狀：** 學生有課程 ID，但課程詳細資料無法獲取

**原因：**
- 課程資料文檔不存在
- 課程資料中的欄位名稱不正確
- 課程資料結構不完整

**解決方案：**
- 檢查課程資料文檔是否存在
- 確保課程資料包含必要欄位：`name`, `subjectTag`, `gradeTags`
- 修復課程資料結構

**檢查方法：**
```javascript
// 檢查特定課程
const courseDoc = await getDoc(doc(db, 'courses', '課程ID'));
console.log('課程資料:', courseDoc.data());
```

### 4. 時段限制不匹配
**症狀：** 時段存在但資格檢查失敗

**原因：**
- 時段的科目限制與學生課程科目不匹配
- 時段的課程限制與學生選修課程不匹配
- 科目名稱格式不一致

**解決方案：**
- 檢查時段的 `subjectRestriction` 和 `courseRestrictions`
- 確保科目名稱格式一致（例如：'數學' vs '數學科'）
- 調整時段限制或學生課程

**檢查方法：**
```javascript
// 檢查時段限制
console.log('時段科目限制:', timeSlot.subjectRestriction);
console.log('時段課程限制:', timeSlot.courseRestrictions);
console.log('學生科目:', studentCourses.map(c => c.subject));
console.log('學生課程ID:', studentCourses.map(c => c.id));
```

### 5. 時段已滿員
**症狀：** 時段存在但顯示已滿員

**原因：**
- 時段的 `currentStudents` 已達到 `maxStudents`
- 時段狀態不是 'available'

**解決方案：**
- 檢查時段的名額設定
- 確認時段狀態為 'available'
- 增加時段名額或建立新時段

**檢查方法：**
```javascript
console.log('時段名額:', `${timeSlot.currentStudents}/${timeSlot.maxStudents}`);
console.log('時段狀態:', timeSlot.status);
```

### 6. 日期不匹配
**症狀：** 時段存在但不在選中的日期

**原因：**
- 時段的日期與學生選擇的日期不匹配
- 日期格式不一致

**解決方案：**
- 檢查日期格式是否一致（YYYY-MM-DD）
- 確認時段日期正確

**檢查方法：**
```javascript
console.log('選中日期:', selectedDate);
console.log('時段日期:', timeSlot.date);
console.log('日期匹配:', timeSlot.date === selectedDate);
```

## 診斷工具

### 1. 開發模式調試信息
在開發模式下，輔導預約頁面會顯示詳細的調試信息：
- 學生課程數量和詳細資料
- 時段資格檢查結果
- 過濾條件匹配情況

### 2. 診斷工具頁面
訪問 `/test-cache` 頁面使用診斷工具：
- 輸入學生帳號獲取課程資料
- 獲取所有可用時段
- 分析時段資格檢查結果

### 3. 瀏覽器控制台
在瀏覽器控制台查看詳細的調試日誌：
```javascript
// 查看學生課程
console.log('學生課程:', studentCourses);

// 查看時段資料
console.log('時段資料:', timeSlots);

// 查看資格檢查結果
console.log('資格檢查:', checkStudentEligibility(timeSlot));
```

## 常見錯誤訊息

### "您不符合此輔導時段的資格要求"
- 檢查學生是否有選修對應科目或課程
- 確認時段限制設定是否正確

### "此日期尚無可用的輔導時段"
- 檢查該日期是否有老師建立時段
- 確認時段狀態為 'available'
- 檢查時段是否已滿員

### "請選擇課程"
- 確認學生有符合時段要求的課程
- 檢查課程資料是否完整

## 預防措施

1. **定期檢查資料完整性**
   - 確保學生資料包含 `enrolledCourses` 欄位
   - 驗證課程資料結構完整性
   - 檢查時段資料格式正確性

2. **統一資料格式**
   - 科目名稱格式統一
   - 日期格式統一（YYYY-MM-DD）
   - 課程 ID 格式一致

3. **監控系統**
   - 記錄資格檢查失敗的原因
   - 監控時段使用情況
   - 追蹤學生課程選修狀態

## 聯繫支援

如果問題持續存在，請提供以下資訊：
1. 學生帳號
2. 具體錯誤訊息
3. 瀏覽器控制台的錯誤日誌
4. 診斷工具的輸出結果 

## 測試案例

### 1. 學生成功預約輔導

- **前提**：
  - 學生已登入
  - 學生已註冊至少一門課程
  - 課程資料包含老師資訊
  - 老師已設定可預約時段
- **步驟**：

### 2. 學生未註冊任何課程

- **前提**：
  - 確保學生資料包含 `enrolledCourses` 欄位
  - 驗證課程資料結構完整性
  - 學生未登入
- **步驟**：

### 3. 學生未註冊任何課程

- **前提**：
  - 確保學生資料包含 `enrolledCourses` 欄位
  - 驗證課程資料結構完整性
  - 學生未登入
- **步驟**： 