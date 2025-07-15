# Calendar 組件時段顯示問題修復總結

## 問題描述
學生在預約輔導時，雖然在月曆中看到某些日期有時段指示（顯示「X 個時段」），但點擊該日期後沒有顯示可申請的時段。

## 根本原因
1. **時段獲取邏輯不一致**：Calendar 組件在學生模式下只獲取選中日期的時段，但時段指示器需要顯示整個月份的時段分布
2. **時段指示器顯示邏輯錯誤**：時段指示器使用 `timeSlots`（選中日期的時段）來顯示，但學生需要看到整個月份的時段分布
3. **學生模式下的時段過濾問題**：學生模式下應該獲取所有老師的時段，而不是特定老師的時段

## 修復內容

### 1. 改進時段獲取邏輯
**修改檔案：** `app/components/Calendar.tsx`

**修復前：**
```javascript
const fetchTimeSlots = async (date: string) => {
  if (!userInfo) return;
  
  try {
    setLoading(true);
    const slots = await getTimeSlots(userInfo.id, date); // 只獲取特定老師的時段
    setTimeSlots(slots as TimeSlot[]);
  } catch (error) {
    console.error('Error fetching time slots:', error);
  } finally {
    setLoading(false);
  }
};
```

**修復後：**
```javascript
const fetchTimeSlots = async (date: string) => {
  if (!userInfo) return;
  
  try {
    setLoading(true);
    
    // 學生模式下獲取所有老師的時段，老師模式下只獲取自己的時段
    let slots;
    if (viewMode === 'student') {
      // 學生模式：獲取所有老師的可用時段
      const q = query(
        collection(db, 'time-slots'),
        where('date', '==', date),
        where('status', '==', 'available')
      );
      const querySnapshot = await getDocs(q);
      slots = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        currentStudents: doc.data().currentStudents || 0,
        maxStudents: doc.data().maxStudents || 1
      }));
    } else {
      // 老師模式：只獲取自己的時段
      slots = await getTimeSlots(userInfo.id, date);
    }
    
    setTimeSlots(slots as TimeSlot[]);
  } catch (error) {
    console.error('Error fetching time slots:', error);
  } finally {
    setLoading(false);
  }
};
```

### 2. 新增整個月份時段獲取功能
**新增功能：** 為學生模式添加獲取整個月份時段的功能

```javascript
// 新增狀態
const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);

// 學生模式下獲取整個月份的時段
useEffect(() => {
  if (viewMode === 'student' && userInfo) {
    fetchAllTimeSlots();
  }
}, [currentDate, viewMode, userInfo]);

// 獲取整個月份的時段（學生模式）
const fetchAllTimeSlots = async () => {
  if (!userInfo) return;
  
  try {
    setLoading(true);
    
    // 獲取當前月份的所有可用時段
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = formatDate(firstDay);
    const endDate = formatDate(lastDay);
    
    const q = query(
      collection(db, 'time-slots'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('status', '==', 'available')
    );
    
    const querySnapshot = await getDocs(q);
    const slots = querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      currentStudents: doc.data().currentStudents || 0,
      maxStudents: doc.data().maxStudents || 1
    }));
    
    setAllTimeSlots(slots as TimeSlot[]);
  } catch (error) {
    console.error('Error fetching all time slots:', error);
  } finally {
    setLoading(false);
  }
};
```

### 3. 修復時段指示器顯示邏輯
**修改檔案：** `app/components/Calendar.tsx`

**修復前：**
```javascript
{timeSlots.filter(slot => slot.date === formatDate(day.date)).length > 0 && (
  <div className="text-xs text-blue-600 font-medium">
    {timeSlots.filter(slot => slot.date === formatDate(day.date)).length} 個時段
  </div>
)}
```

**修復後：**
```javascript
{(() => {
  const dayDate = formatDate(day.date);
  let slotCount = 0;
  
  if (viewMode === 'student') {
    // 學生模式：使用整個月份的時段資料
    slotCount = allTimeSlots.filter(slot => slot.date === dayDate).length;
  } else {
    // 老師模式：使用當前選中日期的時段資料
    slotCount = timeSlots.filter(slot => slot.date === dayDate).length;
  }
  
  return slotCount > 0 ? (
    <div className="text-xs text-blue-600 font-medium">
      {slotCount} 個時段
    </div>
  ) : null;
})()}
```

## 修復效果

### 修復前
- 學生在月曆中看到時段指示，但點擊後沒有時段顯示
- 時段指示器與實際時段獲取邏輯不一致
- 學生模式下無法看到所有老師的時段

### 修復後
- 學生可以在月曆中正確看到整個月份的時段分布
- 點擊有時段的日期後能正確顯示可申請的時段
- 時段指示器與實際時段獲取邏輯一致
- 學生模式下可以看到所有老師的可用時段

## 測試方法

### 1. 使用診斷工具
訪問 `/test-cache` 頁面：
- 輸入學生帳號獲取課程資料
- 點擊「獲取時段」查看時段分布
- 檢查調試信息中的時段按日期分布

### 2. 開發模式調試
在輔導預約頁面查看調試信息：
- 檢查總時段數和可用時段數
- 查看時段資格檢查結果
- 確認時段過濾條件

### 3. 瀏覽器控制台
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

## 相關檔案
- `app/components/Calendar.tsx` - 主要修復檔案
- `app/test-cache/page.tsx` - 診斷工具
- `TUTORING_TROUBLESHOOTING.md` - 故障排除指南
- `CALENDAR_FIX_SUMMARY.md` - 本修復總結

## 注意事項
1. 修復後需要重新測試學生預約輔導功能
2. 確保老師建立時段功能正常運作
3. 監控時段顯示性能，避免載入過多時段影響效能
4. 定期檢查時段資料的完整性 