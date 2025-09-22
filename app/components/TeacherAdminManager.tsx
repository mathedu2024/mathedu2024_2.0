import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Swal from 'sweetalert2';

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
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);

  // 取得管理員/老師列表
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/list');
        const adminList: AdminTeacher[] = await res.json();
        setTeachers(adminList);
      } catch (error) {
        console.error('Error fetching data', error);
        Swal.fire('錯誤', '讀取資料失敗，請稍後再試。', 'error');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // 新增或更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    // Trim whitespace from account and create a clean data object for submission
    const teacherData = { ...editingTeacher, account: editingTeacher.account.trim() };

    if (!teacherData.account) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號不能為空' });
      return;
    }

    // 帳號格式檢查
    if (!/^[A-Za-z0-9]+$/.test(teacherData.account)) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號僅能包含英文字母(區分大小寫)和數字，不能有空白、標點或其他字元' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const isUpdating = !!teacherData.id;

      // 檢查帳號是否重複
      const res = await fetch('/api/admin/list');
      const adminList: AdminTeacher[] = await res.json();
      const isDuplicate = adminList.some((item: AdminTeacher) => {
        if (isUpdating && item.id === teacherData.id) {
          return false;
        }
        return item.account === teacherData.account;
      });

      if (isDuplicate) {
        Swal.fire({ icon: 'warning', title: '警告', text: '此帳號已被使用，請更換帳號' });
        setIsSubmitting(false);
        return;
      }

      const data = {
        ...teacherData,
        id: isUpdating ? teacherData.id : generateRandomId(),
        password: isUpdating ? teacherData.password : DEFAULT_PASSWORD,
      };

      await fetch('/api/admin/create-user', { method: 'POST', body: JSON.stringify(data) });

      setTeachers(prevTeachers => {
        if (isUpdating) {
          return prevTeachers.map(item => item.id === teacherData.id ? data : item);
        } else {
          return [...prevTeachers, data];
        }
      });
      
      Swal.fire('成功', `帳號 ${data.account} 已成功${isUpdating ? '更新' : '建立'}。`, 'success');
      setEditingTeacher(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Submit error:', error);
      Swal.fire('錯誤', '儲存失敗，請稍後再試。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除
  const handleDelete = async (account: string) => {
    if (account === 'test') return;

    const result = await Swal.fire({
      title: '請確認',
      text: '確定要刪除此帳號嗎？此操作無法復原！',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消'
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account }),
      });
      setTeachers(teachers => teachers.filter(item => item.account !== account));
      Swal.fire('已刪除!', '帳號已成功刪除。', 'success');
    } catch {
      Swal.fire('錯誤', '刪除失敗，請稍後再試。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 密碼復原
  const handleResetPassword = async (account: string) => {
    const result = await Swal.fire({
      title: '請確認',
      text: '確定要將密碼復原為預設密碼？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消'
    });

    if (!result.isConfirmed) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/update-password', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.trim(), password: DEFAULT_PASSWORD }) 
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '密碼復原失敗');
      }
      
      Swal.fire('成功', '密碼已復原為預設值。', 'success');
    } catch (error) {
      console.error('密碼復原失敗:', error);
      const message = error instanceof Error ? error.message : '未知錯誤';
      Swal.fire('錯誤', `密碼復原失敗: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
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

  const filteredTeachers = teachers.filter(teacher => {
    const name = teacher.name || '';
    const account = teacher.account || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">老師/管理員管理</h2>
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
      {!isEditing && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-6 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="text"
              placeholder="搜尋姓名或帳號"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full md:w-auto"
            >
              新增帳號
            </button>
          </div>
        </div>
      )}
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
        <div className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size={12} />
              <p className="text-gray-600 ml-4">載入中...</p>
            </div>
          ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">姓名</th>
                  <th scope="col" className="px-6 py-3">帳號</th>
                  <th scope="col" className="px-6 py-3">權限</th>
                  <th scope="col" className="px-6 py-3">備註</th>
                  <th scope="col" className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner size={8} />
                        <span className="mt-2 text-gray-500">讀取中...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTeachers.length > 0 ? filteredTeachers.map(item => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.name}</td>
                    <td className="px-6 py-4">{item.account}</td>
                    <td className="px-6 py-4">{Array.isArray(item.roles) ? item.roles.join(' / ') : (item.roles || '')}</td>
                    <td className="px-6 py-4">{item.note}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3 w-full min-w-[180px]">
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
                          onClick={() => handleResetPassword(item.account)} 
                          disabled={isSubmitting}
                          className="text-yellow-600 hover:text-yellow-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? '處理中...' : '復原密碼'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500">
                      沒有找到符合條件的資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
      
      
    </div>
  );
}