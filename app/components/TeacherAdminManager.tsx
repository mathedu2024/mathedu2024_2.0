'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from './LoadingSpinner';
import PageLoadingArea from './ui/PageLoadingArea';
import { tableActionStyles, tableActionRow, btnStyles, btnWithIconStyle, btnIcon, btnIconGap } from './ui';
import { courseListTableStyles } from './studentCourseListShared';
import Swal from 'sweetalert2';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  UserIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { fetchAdminList, invalidateAdminList, type AdminTeacherRow } from '@/utils/teacherClientApi';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/utils/accountDefaults';

type AdminTeacher = AdminTeacherRow;

const DEFAULT_PASSWORD = DEFAULT_ACCOUNT_PASSWORD;

export default function TeacherAdminManager() {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);

  // 取得管理員/老師列表（共用快取，切換分頁重掛時可命中 TTL）
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const adminList = await fetchAdminList();
        setTeachers(adminList);
      } catch (error) {
        console.error('Error fetching data', error);
        Swal.fire('錯誤', '讀取資料失敗，請稍後再試。', 'error');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // 邀請開通（新帳號）或更新既有帳號
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    const teacherData = {
      ...editingTeacher,
      account: editingTeacher.account.trim(),
      email: String(editingTeacher.email || '').trim().toLowerCase(),
    };
    const isUpdating = !!teacherData.id;

    if (!teacherData.name?.trim()) {
      Swal.fire({ icon: 'warning', title: '警告', text: '姓名不能為空' });
      return;
    }

    if (!teacherData.roles || teacherData.roles.length === 0) {
      Swal.fire({ icon: 'warning', title: '警告', text: '請至少勾選一項系統權限（管理員／老師／作者）' });
      return;
    }

    if (!isUpdating) {
      if (!teacherData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherData.email)) {
        Swal.fire({ icon: 'warning', title: '警告', text: '請輸入有效的電子郵件（Gmail 等）以寄送邀請' });
        return;
      }

      setIsSubmitting(true);
      try {
        const inviteRes = await fetch('/api/admin/invite-teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: teacherData.name.trim(),
            email: teacherData.email,
            roles: teacherData.roles,
            note: teacherData.note || '',
          }),
        });
        const inviteData = await inviteRes.json().catch(() => ({}));
        if (!inviteRes.ok) {
          throw new Error(inviteData.error || '邀請寄送失敗');
        }
        await Swal.fire({
          icon: 'success',
          title: '邀請已寄出',
          html: `已寄送開通邀請至 <b>${teacherData.email}</b>。<br/>對方可自行設定帳號名稱；預設密碼為 <code>${DEFAULT_PASSWORD}</code>。`,
        });
        setEditingTeacher(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Invite error:', error);
        Swal.fire('錯誤', error instanceof Error ? error.message : '邀請失敗，請稍後再試。', 'error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!teacherData.account) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號不能為空' });
      return;
    }

    if (!/^[A-Za-z0-9]+$/.test(teacherData.account)) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號僅能包含英文字母(區分大小寫)和數字，不能有空白、標點或其他字元' });
      return;
    }

    if (teacherData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherData.email)) {
      Swal.fire({ icon: 'warning', title: '警告', text: '電子郵件格式錯誤' });
      return;
    }

    setIsSubmitting(true);
    try {
      const isDuplicate = teachers.some((item) => {
        if (item.id === teacherData.id) return false;
        return item.account === teacherData.account;
      });

      if (isDuplicate) {
        Swal.fire({ icon: 'warning', title: '警告', text: '此帳號已被使用，請更換帳號' });
        setIsSubmitting(false);
        return;
      }

      const data = {
        ...teacherData,
        password: teacherData.password || DEFAULT_PASSWORD,
      };

      const createRes = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || '伺服器錯誤，請稍後再試');
      }

      invalidateAdminList();
      setTeachers((prevTeachers) =>
        prevTeachers.map((item) => (item.id === teacherData.id ? data : item))
      );

      Swal.fire('成功', `帳號 ${data.account} 已成功更新。`, 'success');
      setEditingTeacher(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Submit error:', error);
      Swal.fire('錯誤', error instanceof Error ? error.message : '儲存失敗，請稍後再試。', 'error');
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
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account }),
      });
      invalidateAdminList();
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
      text: `確定要將帳號 ${account} 的密碼復原為預設密碼 (${DEFAULT_PASSWORD})？`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#2D6DF6',
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
    setEditingTeacher({
      id: '',
      name: '',
      account: '',
      email: '',
      password: DEFAULT_PASSWORD,
      roles: ['teacher'],
      note: '',
    });
    setIsEditing(true);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const name = teacher.name || '';
    const account = teacher.account || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <ShieldCheckIcon className="h-8 w-8 text-primary" />
            老師/管理員管理
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">管理教師、管理員與線上文章作者帳號</p>
        </div>
      </div>

      <div className="bg-surface-containerLowest border border-outline-variant/40 p-4 rounded-xl shadow-sm mb-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full min-w-0">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                  type="text"
                  placeholder="搜尋姓名或帳號..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
              />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className={`${btnWithIconStyle(btnStyles.primary)} w-full md:w-auto shrink-0`}
          >
            <PlusIcon className={`${btnIcon} ${btnIconGap}`} />
            邀請開通
          </button>
        </div>
      </div>

      {/* 新增／編輯帳號彈出視窗 — ui-sample Modal Style */}
      {isEditing && editingTeacher && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform scale-100 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5" />
                {editingTeacher.id ? '編輯帳號資料' : '邀請開通新帳號'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-white/80 hover:text-white"
                aria-label="關閉"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <form
              id="teacher-admin-form"
              onSubmit={handleSubmit}
              className="p-6 overflow-y-auto flex-1 custom-scrollbar"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">姓名 <span className="text-red-500">*</span></label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input 
                          type="text" 
                          value={editingTeacher?.name || ''} 
                          onChange={e => setEditingTeacher(prev => prev ? { ...prev, name: e.target.value } : null)} 
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" 
                          required 
                          placeholder="請輸入姓名"
                      />
                  </div>
                </div>

                {editingTeacher.id ? (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">帳號 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={editingTeacher?.account || ''} 
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, account: e.target.value } : null)} 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent font-mono" 
                      required 
                      placeholder="請輸入登入帳號 (英數組合)"
                    />
                    <p className="text-xs text-gray-500 mt-1">僅限英文字母與數字，不可包含空白。</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">電子郵件 <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={editingTeacher?.email || ''}
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                      placeholder="對方的 Gmail / Email"
                    />
                    <p className="text-xs text-gray-500 mt-1">將寄送邀請連結，由對方自行設定帳號名稱。</p>
                  </div>
                )}

                {editingTeacher.id && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">電子郵件</label>
                    <input
                      type="email"
                      value={editingTeacher?.email || ''}
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="用於輔導通知、忘記密碼等"
                    />
                  </div>
                )}
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-3">系統權限 <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-4">
                    <label className={`flex items-center px-4 py-3 border rounded-xl cursor-pointer transition-all ${editingTeacher?.roles?.includes('admin') ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="checkbox" 
                        checked={editingTeacher?.roles?.includes('admin') || false} 
                        onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'admin'] : (prev.roles || []).filter(r => r !== 'admin') } : null)} 
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 accent-[#2D6DF6] cursor-pointer"
                      />
                      <ShieldCheckIcon className="w-5 h-5 mr-2" />
                      <span className="font-medium">系統管理員</span>
                    </label>
                    
                    <label className={`flex items-center px-4 py-3 border rounded-xl cursor-pointer transition-all ${editingTeacher?.roles?.includes('teacher') ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="checkbox" 
                        checked={editingTeacher?.roles?.includes('teacher') || false} 
                        onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'teacher'] : (prev.roles || []).filter(r => r !== 'teacher') } : null)} 
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 accent-[#2D6DF6] cursor-pointer"
                      />
                      <AcademicCapIcon className="w-5 h-5 mr-2" />
                      <span className="font-medium">授課老師</span>
                    </label>

                    <label className={`flex items-center px-4 py-3 border rounded-xl cursor-pointer transition-all ${editingTeacher?.roles?.includes('author') ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="checkbox" 
                        checked={editingTeacher?.roles?.includes('author') || false} 
                        onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'author'] : (prev.roles || []).filter(r => r !== 'author') } : null)} 
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 accent-[#2D6DF6] cursor-pointer"
                      />
                      <PencilSquareIcon className="w-5 h-5 mr-2" />
                      <span className="font-medium">線上文章作者</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    作者需以「作者」身分登入後台，才會看到線上文章選單；管理員與老師身分不承擔線上文章業務。可與老師／管理員權限並存（登入時選擇身分）。
                  </p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">備註說明</label>
                  <textarea 
                    value={editingTeacher?.note || ''} 
                    onChange={e => setEditingTeacher(prev => prev ? { ...prev, note: e.target.value } : null)} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none" 
                    rows={3}
                    placeholder="可選填相關備註..."
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 bg-surface-containerLow border-t border-outline-variant/40 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                form="teacher-admin-form"
                className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-hover shadow-sm flex items-center justify-center disabled:opacity-70"
                disabled={isSubmitting}
              >
                {isSubmitting && <LoadingSpinner size={16} color="white" className="mr-2" />}
                {editingTeacher.id ? '儲存變更' : '寄送邀請'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 列表區域 */}
      <div className="flex-1 min-h-0 flex flex-col">
          {loading && !isEditing ? (
            <PageLoadingArea />
          ) : (
            <>
              {/* Mobile View: Modular Cards */}
              <div className={`${courseListTableStyles.mobile.wrapper} pb-20`}>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map(item => (
                    <div key={item.id} className={courseListTableStyles.mobile.card}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className={courseListTableStyles.mobile.courseName}>{item.name}</div>
                            <p className={`${courseListTableStyles.mobile.courseCode} bg-gray-100 px-2 py-0.5 rounded inline-block`}>{item.account}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                            {item.roles.map(role => (
                                <span key={role} className={`${courseListTableStyles.mobile.statusBadge} ${
                                    role === 'admin'
                                      ? 'bg-tertiary/15 text-tertiary'
                                      : role === 'author'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {role === 'admin' ? '管理員' : role === 'author' ? '作者' : '老師'}
                                </span>
                            ))}
                        </div>
                      </div>
                      
                      {item.note && (
                          <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg border border-outline-variant/40">
                              <span className="font-bold text-gray-400 text-xs uppercase block mb-1">備註</span>
                              {item.note}
                          </div>
                      )}
                      
                      <div className={`${tableActionRow} pt-3 border-t border-gray-100`}>
                        <button 
                          onClick={() => handleResetPassword(item.account)} 
                          className={tableActionStyles.warning}
                          disabled={isSubmitting}
                        >
                          復原密碼
                        </button>
                        <button 
                          onClick={() => handleEdit(item)} 
                          className={tableActionStyles.primary}
                        >
                          編輯
                        </button>
                        <button 
                          onClick={() => handleDelete(item.account)} 
                          className={tableActionStyles.danger}
                          disabled={item.account === 'test'}
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500">沒有找到符合條件的資料</p>
                  </div>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className={`${courseListTableStyles.desktop.wrapper} overflow-x-auto`}>
                <table className={`${courseListTableStyles.desktop.table} table-fixed min-w-[960px]`}>
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[30%]" />
                    <col className="w-[16%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className={courseListTableStyles.desktop.thead}>
                    <tr>
                      <th scope="col" className={courseListTableStyles.desktop.th}>姓名</th>
                      <th scope="col" className={courseListTableStyles.desktop.th}>帳號</th>
                      <th scope="col" className={courseListTableStyles.desktop.th}>權限</th>
                      <th scope="col" className={courseListTableStyles.desktop.th}>備註</th>
                      <th scope="col" className={`${courseListTableStyles.desktop.th} text-right`}>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.length > 0 ? filteredTeachers.map(item => (
                      <tr key={item.id} className={courseListTableStyles.desktop.row}>
                        <td className="px-4 lg:px-6 py-4 align-middle">
                            <div className={`${courseListTableStyles.desktop.courseName} break-words`}>{item.name}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 align-middle">
                            <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block max-w-full truncate">{item.account}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 align-middle">
                            <div className="flex flex-wrap gap-1.5">
                                {item.roles.map(role => (
                                    <span key={role} className={`${courseListTableStyles.desktop.statusBadge} whitespace-nowrap ${
                                        role === 'admin'
                                        ? 'bg-tertiary/10 text-tertiary border border-tertiary/30'
                                        : role === 'author'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                        {role === 'admin' ? '管理員' : role === 'author' ? '作者' : '老師'}
                                    </span>
                                ))}
                            </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-500 align-middle">
                            <div className="line-clamp-2 break-words" title={item.note}>
                              {item.note || '-'}
                            </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right align-middle">
                          <div className={`${courseListTableStyles.desktop.actionRow} justify-end`}>
                            <button 
                              onClick={() => handleResetPassword(item.account)} 
                              className={courseListTableStyles.desktop.actionWarning}
                              disabled={isSubmitting}
                            >
                              復原密碼
                            </button>
                            <button 
                              onClick={() => handleEdit(item)} 
                              className={courseListTableStyles.desktop.actionPrimary}
                            >
                              編輯
                            </button>
                            <button 
                              onClick={() => handleDelete(item.account)} 
                              className={courseListTableStyles.desktop.actionDanger}
                              disabled={item.account === 'test'}
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                                無符合資料
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>
    </div>
  );
}