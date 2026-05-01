'use client';

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  FieldValue,
  deleteDoc
} from 'firebase/firestore';
import { createPortal } from 'react-dom';
import { 
  CloudArrowDownIcon, 
  PlusIcon, 
  FolderIcon, 
  LinkIcon, 
  TrashIcon, 
  PencilSquareIcon,
  KeyIcon,
  XMarkIcon,
  GlobeAsiaAustraliaIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  EyeIcon,
  EyeSlashIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowsUpDownIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import { db, auth } from '@/lib/firebase-client'; // 確保有匯出 auth
import { onAuthStateChanged } from 'firebase/auth';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getSession } from '@/utils/session';
import LoadingSpinner from '@/components/LoadingSpinner';
import Dropdown from '../app/components/Dropdown';
import Swal from 'sweetalert2';

// ============================================================================
// 類型定義
// ============================================================================

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'pdf' | 'document' | 'link'; // 新增 document 型別
  status?: 'public' | 'private'; // 新增獨立的隱私狀態
}

interface ResourceFolder {
  id: string;
  title: string;
  indexCode: string; // 學生搜尋用的 6 位索引碼
  teacherId: string;
  createdByName?: string;
  createdByAccount?: string;
  status: 'public' | 'private';
  items: ResourceItem[];
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

const privacyOptions = [
  { value: 'public', label: '🌐 公開 (學生可搜尋)' },
  { value: 'private', label: '🔒 私有 (僅限自己查看)' }
];

const resourceTypeOptions = [
  { value: 'video', label: '📺 影片' },
  { value: 'document', label: '📄 文件' },
  { value: 'pdf', label: '📄 PDF' },
  { value: 'link', label: '🔗 連結' }
];

export default function ResourceManagement() {
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ResourceFolder | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});

  // 預覽狀態
  const [previewFolder, setPreviewFolder] = useState<ResourceFolder | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const resolveTeacherId = () => {
    const session = getSession();
    return session?.uid || session?.id || null;
  };

  const resolveCreatorInfo = () => {
    const session = getSession();
    return {
      createdByName: session?.name?.trim() || '',
      createdByAccount: session?.account?.trim() || '',
    };
  };

  const getCreatorDisplayName = (folder: ResourceFolder) => {
    if (folder.createdByName?.trim()) return folder.createdByName.trim();
    if (teacherMap[folder.teacherId]) return teacherMap[folder.teacherId];
    if (folder.createdByAccount?.trim()) return folder.createdByAccount.trim();

    // 舊資料相容：若沒有建立人名稱，且 teacherId 是目前登入者，改顯示 session 名稱
    const session = getSession();
    if (folder.teacherId === currentTeacherId) {
      return session?.name?.trim() || session?.account?.trim() || '我';
    }

    // 其他未知建立者，避免直接露出 UID 編號
    return '未命名建立者';
  };

  const getIsAdmin = () => {
    const session = getSession() as {
      user?: { currentRole?: string; activeRole?: string; role?: string | string[]; roles?: string | string[] };
      currentRole?: string;
      activeRole?: string;
      role?: string | string[];
      roles?: string | string[];
    } | null;
    if (!session) return false;
    
    const user = session.user || session;
    // 優先檢查「當前選定的身分 (currentRole / activeRole)」，防範老師與管理員身分共存時，以老師身分登入卻拿到管理員權限
    const activeRole = user.currentRole || user.activeRole || user.role || user.roles || '';
    
    // 若明確為字串，嚴格比對當前登入的身分
    if (typeof activeRole === 'string') {
      return activeRole === 'admin' || activeRole === '管理員';
    }
    // 若系統僅提供陣列，則退而求其次檢查陣列中是否包含管理員
    if (Array.isArray(activeRole)) {
      return activeRole.includes('admin') || activeRole.includes('管理員');
    }
    return false;
  };
  const isAdmin = getIsAdmin();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    fetch('/api/teacher/list')
      .then(res => res.json())
      .then(data => {
        const map: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((t: { id: string; name: string }) => { map[t.id] = t.name; });
        }
        setTeacherMap(map);
      })
      .catch(console.error);
  }, []);

  // 表單狀態
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<'public' | 'private'>('public');
  const [formItems, setFormItems] = useState<ResourceItem[]>([]);

  // 1. 初始化資料
  useEffect(() => {
    let unsubscribeSnap: (() => void) | null = null;

    const setupResourceListener = (teacherId: string | null) => {
      setCurrentTeacherId(teacherId);

      // 如果切換帳號或登出，清理先前的 Firestore 監聽
      if (unsubscribeSnap) {
        unsubscribeSnap();
        unsubscribeSnap = null;
      }

      if (teacherId) {
        setLoading(true);
        // 取消 where 限制，抓取全部資源以支援跨老師搜尋，前端再來做過濾
        const q = query(collection(db, 'resources'));

        unsubscribeSnap = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ResourceFolder));
          setFolders(data);
          setLoading(false);
        }, (error) => {
          console.error('Firestore 監聽失敗:', error);
          setLoading(false);
        });
      } else {
        setLoading(false);
        setFolders([]);
      }
    };

    // 先以 session 做初始判斷，避免 Firebase auth 與本地 session 不一致時誤判未登入
    setupResourceListener(resolveTeacherId());
    setAuthInitialized(true);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const teacherId = user?.uid ?? resolveTeacherId();
      setupResourceListener(teacherId);
      setAuthInitialized(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
    };
  }, []);

  // 工具函式：取得 YouTube 影片 ID
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // 工具函式：根據資源類型取得對應的 Icon
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'video': return <VideoCameraIcon className="w-6 h-6 text-rose-500" />;
      case 'pdf': return <DocumentIcon className="w-6 h-6 text-red-500" />;
      case 'document': return <DocumentTextIcon className="w-6 h-6 text-blue-500" />;
      case 'link': 
      default: return <LinkIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  // 開啟預覽視窗
  const openPreviewModal = (folder: ResourceFolder) => {
    setPreviewFolder(folder);
    setPlayingVideoId(null);
    setIsPreviewModalOpen(true);
  };

  // 2. 產生 6 位隨機索引碼
  const generateIndexCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字元
    let result = '';
    let isUnique = false;

    while (!isUnique) {
      result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      // 檢查是否與現有資料夾的索引碼重複
      isUnique = !folders.some(folder => folder.indexCode === result);
    }
    return result;
  };

  const createEmptyItem = (): ResourceItem => ({
    id: Math.random().toString(36).substr(2, 9),
    title: '',
    url: '',
    type: 'link',
    status: 'public'
  });

  // 3. 開啟建立/編輯彈窗
  const openModal = (folder?: ResourceFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFormTitle(folder.title);
      setFormStatus(folder.status);
      setFormItems([...folder.items]);
    } else {
      setEditingFolder(null);
      setFormTitle('');
      setFormStatus('public');
      // 使用更安全的隨機 ID
      setFormItems([createEmptyItem()]);
    }
    setIsModalOpen(true);
  };

  // 4. 處理子項目變動
  const updateItem = (index: number, field: keyof ResourceItem, value: string) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const addItem = () => {
    setFormItems([...formItems, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItemUrl = (index: number, url: string) => {
    const newItems = [...formItems];
    newItems[index].url = url;
    // 自動判斷分類邏輯
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      newItems[index].type = 'video';
    } else if (url.includes('drive.google.com')) {
      newItems[index].type = 'document';
    } else {
      newItems[index].type = 'link';
    }
    setFormItems(newItems);
  };

  // 拖曳結束處理
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(formItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFormItems(items);
  };

  // 5. 儲存資料
  const handleSave = async () => {
    if (!formTitle.trim()) {
      Swal.fire({ icon: 'error', title: '請輸入資料夾名稱', confirmButtonColor: '#4f46e5' });
      return;
    }

    if (!authInitialized) {
      Swal.fire({
        icon: 'info',
        title: '系統初始化中',
        text: 'Firebase 驗證正在初始化，請稍候再試。',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const teacherIdForSave = currentTeacherId || resolveTeacherId();

    if (!teacherIdForSave) {
      Swal.fire({ 
        icon: 'error', 
        title: '權限失效', 
        text: '目前未登入或登入已過期，請重新登入後再儲存。', 
        confirmButtonColor: '#4f46e5' 
      });
      return;
    }

    // 過濾有效項目，確保標題與網址不為空
    const validItems = formItems
      .filter(item => item.title.trim() && item.url.trim())
      .map(item => ({ 
        id: item.id, 
        title: item.title.trim(), 
        url: item.url.trim(), 
        type: item.type,
        status: item.status || 'public' 
      }));

    const folderIndexCode = editingFolder?.indexCode || generateIndexCode();

    try {
      const timestamp = serverTimestamp();

      if (editingFolder) {
        // 更新時明確指定欄位，避免傳入 teacherId 為 undefined 的風險
        await updateDoc(doc(db, 'resources', editingFolder.id), {
          title: formTitle.trim(),
          status: formStatus,
          items: validItems,
          updatedAt: timestamp,
        });
      } else {
        const { createdByName, createdByAccount } = resolveCreatorInfo();
        await addDoc(collection(db, 'resources'), {
          title: formTitle.trim(),
          status: formStatus,
          items: validItems,
          teacherId: teacherIdForSave,
          createdByName,
          createdByAccount,
          indexCode: folderIndexCode,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      Swal.fire({
        icon: 'success',
        title: editingFolder ? '更新成功！' : '建立成功！',
        text: `學生搜尋碼為：${folderIndexCode}`,
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' }
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error('儲存失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      const isPermissionError = errorMessage.includes('Missing or insufficient permissions');
      Swal.fire({
        icon: 'error',
        title: '儲存失敗',
        text: isPermissionError
          ? '目前帳號沒有寫入資源的權限，請重新登入後再試；若仍失敗，請聯絡管理員檢查 Firestore 規則。'
          : '請稍後再試'
      });
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: '確定要刪除？',
      text: "刪除後，學生將無法使用索引碼存取此資源。",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '是的，刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' }
    }).then(async (result) => {
      if (result.isConfirmed) {
        // 推薦作法：既然用了 Client SDK 監聽，就直接用 Client SDK 刪除，保持邏輯一致
        await deleteDoc(doc(db, 'resources', id));
        // 不需要手動 filter folders，因為 onSnapshot 會自動更新 UI
        Swal.fire('已刪除', '資源已成功移除', 'success');
      }
    });
  };

  // 快速切換資料夾隱私狀態
  const toggleFolderPrivacy = async (folder: ResourceFolder) => {
    try {
      const newStatus = folder.status === 'public' ? 'private' : 'public';
      await updateDoc(doc(db, 'resources', folder.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('無法更改狀態:', error);
      Swal.fire({
        icon: 'error',
        title: '權限錯誤',
        text: '無法更改狀態',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  const filteredFolders = folders.filter(folder => {
    const isOwner = folder.teacherId === currentTeacherId;

    // 1. 搜尋關鍵字判斷
    let meetsSearch = false;
    if (!searchQuery.trim()) {
      // 若無搜尋關鍵字，預設僅顯示「自己建立的」或「自己是管理員」
      meetsSearch = isAdmin || isOwner; 
    } else {
      const q = searchQuery.toLowerCase();
      const matchTitle = folder.title.toLowerCase().includes(q);
      const matchIndex = folder.indexCode.toLowerCase().includes(q);
      const matchName = (folder.createdByName || '').toLowerCase().includes(q) || 
                        (folder.createdByAccount || '').toLowerCase().includes(q) ||
                        getCreatorDisplayName(folder).toLowerCase().includes(q);
      const isKeywordMatched = matchTitle || matchIndex || matchName;
      
      // 若有搜尋，管理員可見所有符合項目；非管理員僅可見「自己的」或「公開的」
      meetsSearch = isKeywordMatched && (isAdmin || isOwner || folder.status === 'public');
    }
    if (!meetsSearch) return false;

    // 2. 狀態篩選判斷
    if (filterStatus !== 'all' && folder.status !== filterStatus) {
      return false;
    }

    // 3. 資源類型篩選判斷
    if (filterType !== 'all') {
      const hasMatchingType = folder.items.some(item => item.type === filterType);
      if (!hasMatchingType) return false;
    }

    return true;
  }).sort((a, b) => {
    const cmp = (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  if (loading) return <div className="p-8 text-center"><LoadingSpinner text="正在載入資源庫..." /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <CloudArrowDownIcon className="h-8 w-8 text-indigo-600" />
            線上資源管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">建立供學生搜尋的教學資源夾與下載連結</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          建立資源資料夾
        </button>
      </div>

      {/* 篩選器 */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
          className="md:hidden w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-medium"
        >
          <span className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-500" /> 篩選與搜尋
          </span>
          {isMobileFilterOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
        </button>

        <div className={`${isMobileFilterOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-4 mt-4 md:mt-0 items-center`}>
          <div className="w-full md:w-40 flex-shrink-0">
            <Dropdown
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'all', label: '所有狀態' },
                { value: 'public', label: '🌐 公開' },
                { value: 'private', label: '🔒 私有' }
              ]}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48 flex-shrink-0">
            <Dropdown
              value={filterType}
              onChange={setFilterType}
              options={[
                { value: 'all', label: '所有資源類型' },
                { value: 'video', label: '📺 包含影片' },
                { value: 'document', label: '📄 包含文件' },
                { value: 'pdf', label: '📄 包含 PDF' },
                { value: 'link', label: '🔗 包含連結' }
              ]}
              className="w-full"
            />
          </div>
          <div className="w-full md:flex-1 relative">
            <input
              type="text"
              placeholder="輸入名稱或索引碼搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-sm"
            />
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="w-full md:w-auto px-4 py-2.5 flex items-center justify-center gap-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors text-sm text-gray-700 font-medium whitespace-nowrap shadow-sm"
            title="切換排序方向"
          >
            <ArrowsUpDownIcon className="w-4 h-4 text-gray-500" />
            {sortDirection === 'asc' ? '名稱順序' : '名稱倒序'}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 桌面版表格檢視 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 group transition-colors select-none"
                  onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  title="點擊切換排序"
                >
                  <div className="flex items-center gap-1">
                    資料夾名稱
                    <ArrowsUpDownIcon className={`w-4 h-4 transition-colors ${sortDirection === 'asc' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">索引碼</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">建立人</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">資源數量</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">隱私狀態</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredFolders.length > 0 ? (
                filteredFolders.map((folder) => {
                  const isOwner = folder.teacherId === currentTeacherId;
                  const canEdit = isAdmin || isOwner;

                  return (
                    <tr key={folder.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <FolderIcon className="h-5 w-5" />
                          </div>
                          <span className="font-bold text-gray-800">{folder.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 flex items-center gap-1 w-fit">
                          <KeyIcon className="h-3 w-3" /> {folder.indexCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {getCreatorDisplayName(folder)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <LinkIcon className="h-4 w-4 text-gray-400" /> {folder.items.length} 個連結
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => canEdit && toggleFolderPrivacy(folder)}
                          disabled={!canEdit}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                            folder.status === 'public'
                              ? 'bg-emerald-100 text-emerald-700 ' + (canEdit ? 'hover:bg-emerald-200' : '')
                              : 'bg-gray-100 text-gray-500 ' + (canEdit ? 'hover:bg-gray-200' : '')
                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {folder.status === 'public' ? <GlobeAsiaAustraliaIcon className="h-3 w-3" /> : <LockClosedIcon className="h-3 w-3" />}
                          {folder.status === 'public' ? '公開' : '私有'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button 
                        onClick={() => openPreviewModal(folder)}
                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                        title="預覽"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                        {canEdit ? (
                          <>
                            <button 
                              onClick={() => openModal(folder)}
                              className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="編輯"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(folder.id)}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="刪除"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">無編輯權限</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <FolderIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    沒有符合的資源資料夾
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 手機版卡片視圖 */}
      <div className="md:hidden space-y-4 mt-4">
        {filteredFolders.length > 0 ? (
          filteredFolders.map(folder => {
            const isOwner = folder.teacherId === currentTeacherId;
            const canEdit = isAdmin || isOwner;

            return (
              <div key={folder.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform">
                <div className="flex justify-between items-start">
                   <div>
                       <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                         <FolderIcon className="w-5 h-5 text-indigo-500" />
                         {folder.title}
                       </h3>
                       <p className="text-xs font-mono text-gray-500 mt-1 flex items-center gap-1">
                         <KeyIcon className="w-3 h-3" /> {folder.indexCode} | {getCreatorDisplayName(folder)}
                       </p>
                   </div>
                   <button
                     onClick={() => canEdit && toggleFolderPrivacy(folder)}
                     disabled={!canEdit}
                     className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors shadow-sm ${
                       folder.status === 'public'
                         ? 'bg-emerald-50 text-emerald-700 ' + (canEdit ? 'hover:bg-emerald-100' : '')
                         : 'bg-gray-100 text-gray-600 ' + (canEdit ? 'hover:bg-gray-200' : '')
                     } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                   >
                     {folder.status === 'public' ? <GlobeAsiaAustraliaIcon className="h-3 w-3" /> : <LockClosedIcon className="h-3 w-3" />}
                     {folder.status === 'public' ? '公開' : '私有'}
                   </button>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-1">
                  <LinkIcon className="w-4 h-4 text-gray-400" /> {folder.items.length} 個資源
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-end gap-2">
                   <button onClick={(e) => { e.stopPropagation(); openPreviewModal(folder); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="預覽">
                     <EyeIcon className="w-5 h-5" />
                   </button>
                   {canEdit && (
                     <>
                     <button onClick={(e) => { e.stopPropagation(); openModal(folder); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                       <PencilSquareIcon className="w-5 h-5" />
                     </button>
                     <button onClick={(e) => { e.stopPropagation(); handleDelete(folder.id); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                       <TrashIcon className="w-5 h-5" />
                     </button>
                     </>
                   )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl bg-white">
            沒有符合的資源資料夾
          </div>
        )}
      </div>

      {/* Edit/Create Modal (Tailwind Implementation) */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-pop-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex justify-between items-center text-white">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {editingFolder ? <PencilSquareIcon className="h-6 w-6" /> : <PlusIcon className="h-6 w-6" />}
                  {editingFolder ? '編輯資源資料夾' : '建立資源資料夾'}
                </h3>
                <p className="text-indigo-100 text-xs mt-1">
                  {editingFolder ? `索引碼：${editingFolder.indexCode}` : '系統將自動產生唯一的搜尋索引碼'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <label className="text-gray-700 text-sm font-bold md:text-right">資料夾名稱</label>
                  <input 
                    type="text" 
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="例如：113學測複習講義" 
                    className="md:col-span-3 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <label className="text-gray-700 text-sm font-bold md:text-right">隱私狀態</label>
                  <div className="md:col-span-3">
                    <Dropdown 
                      value={formStatus}
                      onChange={(val) => setFormStatus(val as 'public' | 'private')}
                      options={privacyOptions}
                      className="w-full"
                      buttonClassName="border-gray-300"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-indigo-500" /> 資源清單
                  </h4>
                  <button 
                    onClick={addItem}
                    className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                  >
                    + 新增一項
                  </button>
                </div>

                <div className="space-y-4">
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="resource-items">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {formItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="p-4 bg-gray-50 rounded-2xl space-y-3 relative group/item border border-gray-100"
                                >
                                  <div
                                    {...provided.dragHandleProps}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-500 cursor-grab active:cursor-grabbing"
                                  >
                                    <Bars3Icon className="w-5 h-5" />
                                  </div>
                                  <div className="pl-8 space-y-3">
                                    <div className="flex flex-col md:flex-row gap-3">
                                      <div className="flex-1">
                                        <input 
                                          type="text" 
                                          placeholder="標題 (例如：微積分第一章影片)"
                                          value={item.title}
                                          onChange={(e) => updateItem(index, 'title', e.target.value)}
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                      </div>
                                      <div className="flex gap-2 w-full md:w-auto">
                                        <div className="w-32">
                                          <Dropdown 
                                            value={item.type}
                                            onChange={(val) => updateItem(index, 'type', val)}
                                            options={resourceTypeOptions}
                                            className="w-full"
                                            buttonClassName="py-2 border-gray-200 rounded-lg text-sm"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => updateItem(index, 'status', item.status === 'private' ? 'public' : 'private')}
                                          className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors ${
                                            item.status === 'private' ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                                          }`}
                                          title="切換項目隱私狀態"
                                        >
                                          {item.status === 'private' ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                                          <span className="hidden sm:inline">{item.status === 'private' ? '私有' : '公開'}</span>
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                      <div className="flex-1 relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                          <LinkIcon className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input 
                                          type="url" 
                                          placeholder="資源網址 (https://...)"
                                          value={item.url}
                                          onChange={(e) => updateItemUrl(index, e.target.value)}
                                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                      </div>
                                      <button 
                                        onClick={() => removeItem(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                      >
                                        <TrashIcon className="h-5 w-5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-white border border-gray-300 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                儲存資源資料夾
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && previewFolder && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <EyeIcon className="h-6 w-6" />
                  預覽資源：{previewFolder.title}
                </h3>
                <p className="text-indigo-100 text-xs mt-1">
                  以學生視角查看資源內容。
                </p>
              </div>
              <button onClick={() => { setIsPreviewModalOpen(false); setPlayingVideoId(null); }} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {playingVideoId ? (
                <div className="space-y-4 h-full flex flex-col">
                  <button 
                    onClick={() => setPlayingVideoId(null)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 w-fit transition-colors"
                  >
                    &larr; 返回清單
                  </button>
                  <div className="relative w-full pt-[56.25%] bg-black rounded-xl overflow-hidden shadow-lg">
                    <iframe
                      src={`https://www.youtube.com/embed/${playingVideoId}?modestbranding=1&rel=0`}
                      title="YouTube video player"
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previewFolder.items.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                      此資料夾目前沒有資源項目。
                    </div>
                  ) : (
                    // 在預覽模式隱藏設為私有的資源 (還原學生實際能看到的項目)
                    previewFolder.items.filter(item => item.status !== 'private').length === 0 ? (
                      <div className="col-span-1 md:col-span-2 text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        此資料夾中目前沒有公開的資源項目。
                      </div>
                    ) : (
                      previewFolder.items.filter(item => item.status !== 'private').map((item, index) => {
                        const ytId = item.type === 'video' ? getYouTubeId(item.url) : null;
                        
                        if (ytId) {
                          return (
                            <button 
                              key={item.id || index} 
                              onClick={() => setPlayingVideoId(ytId)}
                              className="flex items-center text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 transition-all group w-full"
                            >
                              <div className="mr-4 p-3 bg-rose-50 rounded-xl text-rose-500 group-hover:bg-rose-100 transition-colors">
                                <VideoCameraIcon className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors block truncate">
                                  {item.title}
                                </span>
                                <span className="text-xs text-gray-500 mt-1 block">點擊在站內觀看影片</span>
                              </div>
                            </button>
                          );
                        }

                        return (
                          <a 
                            key={item.id || index} 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                          >
                            <div className="mr-4 p-3 bg-gray-50 rounded-xl text-gray-500 group-hover:bg-indigo-50 transition-colors">
                              {getItemIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors block truncate">
                                {item.title}
                              </span>
                              <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" /> 新分頁開啟連結
                              </span>
                            </div>
                          </a>
                        );
                      })
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}