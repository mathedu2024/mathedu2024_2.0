import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';

interface AdminTeacher {
  id: string;
  name: string;
  account: string;
  password: string;
  roles: ('admin' | 'teacher')[];
  note?: string;
}

const DEFAULT_PASSWORD = 'abcd1234';

function generateRandomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.floor(Math.random() * 100000).toString();
}

export default function TeacherAdminManager() {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetId, setShowResetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [alert, setAlert] = useState({ open: false, message: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState<AdminTeacher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // 取得管理員/老師列表
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/list');
        const adminList: any[] = await res.json();
        setTeachers(adminList);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // 新增或更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    // 帳號格式檢查
    if (!/^[A-Za-z0-9]+$/.test(editingTeacher.account)) {
      setAlert({ open: true, message: '帳號僅能包含英文字母(區分大小寫)和數字，不能有空白、標點或其他字元' });
      return;
    }
    setIsSubmitting(true);
    try {
      // 檢查帳號是否重複
      const res = await fetch('/api/admin/list');
      const adminList: any[] = await res.json();
      const isDuplicate = adminList.some((item: any) => {
        // 若是更新，允許自己
        if (editingTeacher.id && item.account === editingTeacher.account) return false;
        return item.account === editingTeacher.account;
      });
      if (isDuplicate) {
        setAlert({ open: true, message: '此帳號已被使用，請更換帳號' });
        setIsSubmitting(false);
        return;
      }
      // 設定 id 為亂碼
      const randomId = generateRandomId();
      const data = { ...editingTeacher, id: randomId, password: DEFAULT_PASSWORD };
      // 檔名為帳號
      const docId = editingTeacher.account;
      // 新增或更新都統一呼叫 create-user API
      await fetch('/api/admin/create-user', { method: 'POST', body: JSON.stringify(data) });
      // 更新本地 teachers 狀態
      setTeachers(teachers => {
        const exists = teachers.some(item => item.account === editingTeacher.account);
        if (exists) {
          return teachers.map(item => item.account === editingTeacher.account ? { ...data } : item);
        } else {
          return [...teachers, { ...data }];
      }
      });
      setEditingTeacher(null);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除
  const handleDelete = async (account: string) => {
    // Prevent deleting the test account
    if (account === 'test') return;
    const confirmDelete = window.confirm('確定要刪除此帳號嗎？此操作無法復原！');
    if (!confirmDelete) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account }),
      });
      setTeachers(teachers => teachers.filter(item => item.account !== account));
      setAlert({ open: true, message: '帳號已成功刪除' });
    } catch (error) {
      setAlert({ open: true, message: '刪除失敗，請稍後再試。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 密碼復原
  const handleResetPassword = async (id: string) => {
    await fetch('/api/admin/update-password', { method: 'POST', body: JSON.stringify({ id, password: DEFAULT_PASSWORD }) });
    setShowResetId(null);
    setAlert({ open: true, message: '密碼已復原為預設值' });
  };

  const handleCancel = () => {
    setEditingTeacher(null);
    setIsEditing(false);
  };

  const handleEdit = (item: AdminTeacher) => {
    setEditingTeacher(item);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingTeacher({ id: '', name: '', account: '', password: DEFAULT_PASSWORD, roles: [], note: '' });
    setIsEditing(true);
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4">
      <h2 className="text-2xl font-bold mb-6">老師/管理員管理</h2>
      <div className="block md:flex gap-4 items-center mb-6">
        {/* 手機下Accordion */}
        <div className="md:hidden">
          {/* 請找到 <summary className="font-bold text-base cursor-pointer">管理群組</summary> 所在的 Accordion 或區塊，將其整個區塊（包含 summary、內容、外層 details/Accordion）刪除或註解掉。 */}
        </div>
        <div className="hidden md:flex gap-4 items-center">
          <div className="text-sm text-gray-600">
            管理老師與管理員帳號，設定權限與角色
          </div>
        </div>
      </div>
      <div className="mb-6 flex justify-end">
        {!isEditing && (
          <button
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            onClick={handleAdd}
          >
            新增帳號
          </button>
        )}
      </div>
      {/* 新增/編輯表單 */}
      {isEditing && editingTeacher && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            {editingTeacher.id ? '編輯帳號' : '新增帳號'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">姓名 *</label>
                <input 
                  type="text" 
                  value={editingTeacher?.name || ''} 
                  onChange={e => setEditingTeacher(prev => prev ? { ...prev, name: e.target.value } : { id: '', name: e.target.value, account: '', password: DEFAULT_PASSWORD, roles: [], note: '' })} 
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">帳號 *</label>
                <input 
                  type="text" 
                  value={editingTeacher?.account || ''} 
                  onChange={e => setEditingTeacher(prev => prev ? { ...prev, account: e.target.value } : { id: '', name: '', account: e.target.value, password: DEFAULT_PASSWORD, roles: [], note: '' })} 
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">權限 *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={editingTeacher?.roles?.includes('admin') || false} 
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'admin'] : (prev.roles || []).filter(r => r !== 'admin') } : null)} 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">管理員</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={editingTeacher?.roles?.includes('teacher') || false} 
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'teacher'] : (prev.roles || []).filter(r => r !== 'teacher') } : null)} 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">老師</span>
                  </label>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
                <textarea 
                  value={editingTeacher?.note || ''} 
                  onChange={e => setEditingTeacher(prev => prev ? { ...prev, note: e.target.value } : null)} 
                  className="input-unified resize-none" 
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary px-6 py-2"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn-primary px-6 py-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoadingSpinner size={5} className="mr-2" /> : null}
                {editingTeacher.id ? '更新' : '新增'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 列表區域 - 編輯時隱藏 */}
      {!isEditing && (
        <>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size={12} />
              <p className="text-gray-600 ml-4">載入中...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teachers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>尚無帳號資料</p>
                </div>
              ) : (
                teachers.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 p-6 rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-gray-900 mb-2">
                          {item.name} ({item.account})
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>權限：{Array.isArray(item.roles) ? item.roles.join(' / ') : (item.roles || '')}</p>
                          {item.note && <p>備註：{item.note}</p>}
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4 md:mt-0">
                        <button 
                          onClick={() => handleEdit(item)} 
                          className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          編輯
                        </button>
                        <button 
                          onClick={() => handleDelete(item.account)} 
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                        >
                          刪除
                        </button>
                        <button 
                          onClick={() => setShowResetId(item.id)} 
                          className="text-yellow-600 hover:text-yellow-800 font-medium transition-colors"
                        >
                          復原密碼
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
      {/* 密碼復原彈窗 */}
      {showResetId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="mb-4 text-gray-900">確定要將密碼復原為預設密碼？</div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => handleResetPassword(showResetId)} 
                className="btn-warning px-4 py-2"
              >
                確定
              </button>
              <button 
                onClick={() => setShowResetId(null)} 
                className="btn-secondary px-4 py-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={alert.open} message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />
    </div>
  );
} 