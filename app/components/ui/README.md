# UI 元件庫

這個目錄包含了統一的 UI 元件，用於替換專案中重複的樣式實現。

## 元件列表

### 基礎元件

#### Button
統一的按鈕元件，支援多種變體和尺寸。

```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  點擊我
</Button>

<Button variant="danger" loading={true}>
  刪除
</Button>
```

#### Card
統一的卡片元件，支援多種變體和顏色。

```tsx
import { Card } from '@/components/ui';

<Card variant="default" color="blue">
  <h3>標題</h3>
  <p>內容</p>
</Card>

<Card variant="stats" color="green" onClick={handleClick}>
  統計卡片
</Card>
```

#### Input
統一的輸入框元件，支援多種類型和驗證。

```tsx
import { Input } from '@/components/ui';

<Input
  type="text"
  label="用戶名"
  placeholder="請輸入用戶名"
  value={username}
  onChange={setUsername}
  required
/>

<Input
  type="email"
  label="電子郵件"
  error="請輸入有效的電子郵件"
  value={email}
  onChange={setEmail}
/>
```

#### Select
統一的下拉選單元件。

```tsx
import { Select } from '@/components/ui';

const options = [
  { value: 'option1', label: '選項 1' },
  { value: 'option2', label: '選項 2' }
];

<Select
  options={options}
  value={selectedValue}
  onChange={setSelectedValue}
  label="選擇選項"
/>
```

#### Modal
統一的模態框元件，支援多種尺寸。

```tsx
import { Modal } from '@/components/ui';

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="標題"
  size="lg"
>
  <p>模態框內容</p>
</Modal>
```

#### LoadingSpinner
統一的載入動畫元件。

```tsx
import { LoadingSpinner } from '@/components/ui';

<LoadingSpinner size="md" text="載入中..." />

<LoadingSpinner fullScreen={true} />
```

### 複合元件

#### StatsCard
統計卡片元件，用於顯示數據統計。

```tsx
import { StatsCard } from '@/components/ui';

<StatsCard
  title="總用戶數"
  value="1,234"
  icon={<UserIcon />}
  color="blue"
  trend="up"
  trendValue="+12%"
/>
```

#### QuickActionCard
快速操作卡片元件，用於儀表板。

```tsx
import { QuickActionCard } from '@/components/ui';

<QuickActionCard
  title="新增課程"
  description="建立新的課程"
  icon={<PlusIcon />}
  onClick={handleAddCourse}
  color="green"
/>
```

#### UserAvatar
用戶頭像元件。

```tsx
import { UserAvatar } from '@/components/ui';

<UserAvatar
  name="張三"
  role="老師"
  email="zhang@example.com"
  size="lg"
/>
```

## 使用指南

### 導入方式

```tsx
// 單一導入
import { Button } from '@/components/ui';

// 批量導入
import { Button, Card, Input, Modal } from '@/components/ui';
```

### 樣式覆蓋

所有元件都支援 `className` 屬性來覆蓋預設樣式：

```tsx
<Button className="custom-button-class">
  自定義按鈕
</Button>
```

### 響應式設計

所有元件都內建響應式設計，支援不同螢幕尺寸。

### 無障礙支援

元件都包含適當的 ARIA 標籤和鍵盤導航支援。

## 遷移指南

### 從舊按鈕樣式遷移

**舊方式：**
```tsx
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
  按鈕
</button>
```

**新方式：**
```tsx
<Button variant="primary">
  按鈕
</Button>
```

### 從舊卡片樣式遷移

**舊方式：**
```tsx
<div className="bg-white rounded-lg shadow-md p-6">
  內容
</div>
```

**新方式：**
```tsx
<Card>
  內容
</Card>
```

### 從舊模態框遷移

**舊方式：**
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
    內容
  </div>
</div>
```

**新方式：**
```tsx
<Modal open={isOpen} onClose={handleClose}>
  內容
</Modal>
```

## 最佳實踐

1. **優先使用新元件**：新功能開發時優先使用這些統一元件
2. **逐步遷移**：逐步將現有程式碼遷移到新元件
3. **保持一致性**：使用相同的變體和尺寸來保持 UI 一致性
4. **自定義樣式**：需要特殊樣式時使用 `className` 屬性
5. **測試響應式**：確保在不同螢幕尺寸下正常顯示 