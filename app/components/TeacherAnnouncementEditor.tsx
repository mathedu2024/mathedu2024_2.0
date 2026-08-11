'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import { PageLoadingArea, BackButton, LoadingSpinner } from './ui';
import {
  MegaphoneIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import RichTextEditor from '../../components/RichTextEditor';
import { teacherCourseHubPath, resolveReturnTo } from '@/utils/teacherCourseHub';
import { isStudentVisible } from './StudentVisibilityToggle';
import type { Course } from './TeacherCourseManager';
import { stripHtml } from '@/utils/richText';
import { buildCourseAnnouncementEmail, sendAppEmails } from '@/utils/email';
import { getSiteUrl } from '@/utils/accountDefaults';

export interface CourseAnnouncement {
  id: string;
  title: string;
  content: string;
  links: { name: string; url: string }[];
  createdAt: string;
  visibleToStudents?: boolean;
  visiblePublishedAt?: string;
  /** ISO：預定發佈時間（未來且未對學生開放時顯示為「預定」） */
  scheduledAt?: string;
  /** 點閱數（尚未統計時可為 undefined） */
  viewsCount?: number;
}

const emptyAnnouncement = (): CourseAnnouncement => ({
  id: 'new',
  title: '',
  content: '',
  links: [],
  createdAt: '',
  visibleToStudents: false,
});

type PublishMode = 'now' | 'schedule' | 'draft';

interface TeacherAnnouncementEditorProps {
  course: Course;
  /** null 或 'new' 表示新增 */
  announcementId: string | null;
  isArchived?: boolean;
  returnTo?: string | null;
  onCourseUpdated?: (course: Course) => void;
}

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | undefined {
  if (!local.trim()) return undefined;
  const t = Date.parse(local);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

export default function TeacherAnnouncementEditor({
  course,
  announcementId,
  isArchived = false,
  returnTo,
  onCourseUpdated,
}: TeacherAnnouncementEditorProps) {
  const router = useRouter();
  const isNew = !announcementId || announcementId === 'new';
  const backPath = resolveReturnTo(returnTo, teacherCourseHubPath(course.code, 'announcements'));

  const [form, setForm] = useState<CourseAnnouncement>(emptyAnnouncement());
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>('draft');
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>(
    course.announcements || []
  );

  const goBack = useCallback(() => {
    router.push(backPath);
  }, [router, backPath]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let list = course.announcements || [];
      try {
        const res = await fetch(`/api/courses/classdata?courseId=${course.id}`);
        if (res.ok) {
          const data = await res.json();
          list = data.announcements ?? list;
        }
      } catch {
        /* use course.announcements */
      }
      if (cancelled) return;
      setAnnouncements(list);

      if (isNew) {
        setForm(emptyAnnouncement());
        setPublishMode('draft');
        setScheduleLocal('');
        setNotifyByEmail(false);
        setIsLoading(false);
        setNotFound(false);
        return;
      }

      const found = list.find((a) => a.id === announcementId) ?? null;
      if (!found) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setForm({
        ...found,
        links: found.links || [],
        visibleToStudents: found.visibleToStudents !== false,
      });
      const scheduledFuture =
        found.scheduledAt &&
        Date.parse(found.scheduledAt) > Date.now() &&
        !isStudentVisible(found.visibleToStudents);
      if (scheduledFuture) {
        setPublishMode('schedule');
        setScheduleLocal(toDatetimeLocalValue(found.scheduledAt));
      } else if (isStudentVisible(found.visibleToStudents)) {
        setPublishMode('now');
        setScheduleLocal('');
      } else {
        setPublishMode('draft');
        setScheduleLocal(toDatetimeLocalValue(found.scheduledAt));
      }
      setIsLoading(false);
    };

    setIsLoading(true);
    void load();
    return () => {
      cancelled = true;
    };
  }, [course.id, course.announcements, isNew, announcementId]);

  const applyPublishMode = (base: CourseAnnouncement, mode: PublishMode): CourseAnnouncement => {
    const nowIso = new Date().toISOString();
    if (mode === 'draft') {
      return {
        ...base,
        visibleToStudents: false,
        visiblePublishedAt: undefined,
        scheduledAt: undefined,
      };
    }
    if (mode === 'schedule') {
      const scheduledAt = fromDatetimeLocalValue(scheduleLocal);
      return {
        ...base,
        visibleToStudents: false,
        visiblePublishedAt: undefined,
        scheduledAt,
      };
    }
    return {
      ...base,
      visibleToStudents: true,
      scheduledAt: undefined,
      visiblePublishedAt: base.visiblePublishedAt || nowIso,
    };
  };

  const persist = async (mode: PublishMode) => {
    if (!form.title?.trim() || !form.content?.trim()) {
      void Swal.fire('警告', '標題與內容為必填', 'warning');
      return;
    }
    if (mode === 'schedule') {
      const scheduledAt = fromDatetimeLocalValue(scheduleLocal);
      if (!scheduledAt || Date.parse(scheduledAt) <= Date.now()) {
        void Swal.fire('警告', '請設定未來的預定發佈時間', 'warning');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const withPublishStamp = applyPublishMode(form, mode);

      const newAnns =
        withPublishStamp.id === 'new'
          ? [{ ...withPublishStamp, id: Date.now().toString(), createdAt: nowIso }, ...announcements]
          : announcements.map((a) => (a.id === withPublishStamp.id ? withPublishStamp : a));

      const res = await fetch('/api/courses/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id, announcements: newAnns }),
      });
      if (!res.ok) throw new Error('Update failed');

      const updatedCourse = { ...course, announcements: newAnns };
      onCourseUpdated?.(updatedCourse);

      let emailSummary = '';
      const shouldNotify =
        notifyByEmail && isStudentVisible(withPublishStamp.visibleToStudents);
      if (shouldNotify) {
        try {
          const listRes = await fetch(`/api/course-student-list/list?courseId=${course.id}`);
          const students = listRes.ok ? await listRes.json() : [];
          const preview = stripHtml(withPublishStamp.content || '');
          const buttonUrl = `${getSiteUrl()}/student`;
          const payloads = (Array.isArray(students) ? students : [])
            .map((s: { email?: string; name?: string; studentEmail?: string }) => {
              const toEmail = String(s.email || s.studentEmail || '').trim();
              if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) return null;
              return buildCourseAnnouncementEmail({
                toEmail,
                studentName: String(s.name || ''),
                courseName: course.name,
                courseCode: course.code,
                announcementTitle: withPublishStamp.title,
                contentPreview: preview,
                buttonUrl,
              });
            })
            .filter((item): item is NonNullable<typeof item> => item != null);

          if (payloads.length === 0) {
            emailSummary = '已儲存，但沒有可寄送的學生電子郵件。';
          } else {
            const { sent, failed } = await sendAppEmails(payloads);
            emailSummary =
              failed > 0
                ? `已儲存。Email 通知：成功 ${sent} 封、失敗 ${failed} 封。`
                : `已儲存，並已寄送 ${sent} 封 Email 通知。`;
          }
        } catch (emailErr) {
          console.warn('Announcement email notify failed:', emailErr);
          emailSummary = '已儲存，但 Email 通知寄送失敗。';
        }
      }

      await Swal.fire({
        icon: 'success',
        title: mode === 'draft' ? '草稿已儲存' : mode === 'schedule' ? '已排定發佈' : '發佈成功',
        text: emailSummary || undefined,
        customClass: { popup: 'rounded-2xl' },
      });
      goBack();
    } catch {
      void Swal.fire('錯誤', '儲存失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
        <PageLoadingArea />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
        <div className="flex flex-col gap-4">
          <BackButton label="返回課程公告" onClick={goBack} withSpacing={false} />
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
            <h3 className="text-xl font-bold text-gray-900">找不到此公告</h3>
            <p className="text-gray-500 text-sm mt-2">請返回課程公告重新選擇。</p>
          </div>
        </div>
      </div>
    );
  }

  const pageTitle = isArchived ? '查看公告' : isNew ? '新增公告' : '編輯公告';

  return (
    <div className="w-full min-w-0 flex flex-col animate-fade-in pb-28">
      <nav className="flex text-sm text-on-surfaceVariant mb-4 flex-wrap items-center gap-1">
        <button type="button" onClick={goBack} className="hover:text-primary transition-colors">
          公告管理
        </button>
        <span className="text-outline-variant mx-1">/</span>
        <span className="text-on-surface font-bold">{pageTitle}</span>
      </nav>

      <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
        <MegaphoneIcon className="w-7 h-7 text-primary shrink-0" />
        {pageTitle}
      </h2>

      {isArchived && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center shadow-sm mb-5">
          <span className="font-bold mr-2">提示：</span>
          此為封存課程，僅供檢視。
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側：標題＋內容＋連結 */}
        <div className="flex-1 bg-surface-containerLowest rounded-xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-6 min-w-0">
          <div>
            <label className="sr-only" htmlFor="post-title">
              公告標題
            </label>
            <input
              id="post-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              disabled={isArchived}
              placeholder="請輸入公告標題"
              className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 transition-colors placeholder:text-outline-variant text-on-surface outline-none disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col border border-outline-variant rounded-lg overflow-hidden focus-within:border-primary transition-colors min-h-[360px]">
            {isArchived ? (
              <div
                className="p-4 prose prose-sm max-w-none text-on-surface"
                dangerouslySetInnerHTML={{
                  __html: form.content || '<p class="text-outline">（無內容）</p>',
                }}
              />
            ) : (
              <div className="p-2 sm:p-3 flex-1 bg-surface-containerLowest">
                <RichTextEditor
                  instanceKey={form.id}
                  value={form.content}
                  onChange={(content) => setForm((prev) => ({ ...prev, content }))}
                  placeholder="在此輸入公告內容..."
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-on-surface">相關連結</h3>
              {!isArchived && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      links: [...(prev.links || []), { name: '', url: '' }],
                    }))
                  }
                  className="text-primary text-xs font-bold hover:opacity-80 inline-flex items-center"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  新增連結
                </button>
              )}
            </div>
            {(form.links || []).length === 0 ? (
              <p className="text-sm text-outline">尚未新增連結。</p>
            ) : (
              <div className="space-y-2">
                {(form.links || []).map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="連結名稱"
                      value={link.name}
                      disabled={isArchived}
                      onChange={(e) => {
                        const newLinks = [...form.links];
                        newLinks[idx] = { ...newLinks[idx], name: e.target.value };
                        setForm((prev) => ({ ...prev, links: newLinks }));
                      }}
                      className="w-1/3 border border-outline-variant rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-surface-containerLow"
                    />
                    <input
                      type="url"
                      placeholder="網址 (URL)"
                      value={link.url}
                      disabled={isArchived}
                      onChange={(e) => {
                        const newLinks = [...form.links];
                        newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                        setForm((prev) => ({ ...prev, links: newLinks }));
                      }}
                      className="flex-1 border border-outline-variant rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-surface-containerLow"
                    />
                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = form.links.filter((_, i) => i !== idx);
                          setForm((prev) => ({ ...prev, links: newLinks }));
                        }}
                        className="p-1.5 text-error hover:bg-error-container rounded-lg"
                        title="移除連結"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側：發佈／通知 */}
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-on-surface">
              <PaperAirplaneIcon className="w-5 h-5 text-primary" />
              發佈設定
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-on-surfaceVariant mb-2">發佈目標</label>
                <select
                  disabled
                  className="w-full rounded-lg border-outline-variant text-sm py-2 px-3 bg-surface-containerLow text-on-surfaceVariant"
                  value="all"
                >
                  <option value="all">所有學生</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surfaceVariant mb-2">發佈時間</label>
                <div className="flex flex-col gap-1">
                  {(
                    [
                      ['now', '立即發佈'],
                      ['schedule', '預定發佈'],
                      ['draft', '存為草稿'],
                    ] as const
                  ).map(([mode, label]) => (
                    <label
                      key={mode}
                      className={`flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-containerLow transition-colors ${
                        isArchived ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="publish_time"
                        checked={publishMode === mode}
                        onChange={() => {
                          setPublishMode(mode);
                          if (mode === 'now') setNotifyByEmail(true);
                          if (mode === 'draft') setNotifyByEmail(false);
                        }}
                        disabled={isArchived}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                  <div
                    className={`pl-7 pr-1 mt-1 ${
                      publishMode === 'schedule' ? '' : 'opacity-50 pointer-events-none'
                    }`}
                  >
                    <input
                      type="datetime-local"
                      value={scheduleLocal}
                      onChange={(e) => setScheduleLocal(e.target.value)}
                      disabled={isArchived || publishMode !== 'schedule'}
                      className="w-full rounded-md border border-outline-variant text-sm py-1.5 px-2 bg-surface-containerLowest focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-on-surface">
              <BellAlertIcon className="w-5 h-5 text-secondary" />
              通知選項
            </h3>
            <div className="space-y-3">
              <label
                className={`flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-surface-containerLow transition-colors ${
                  publishMode !== 'now' || isArchived ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={notifyByEmail}
                  onChange={(e) => setNotifyByEmail(e.target.checked)}
                  disabled={isArchived || publishMode !== 'now'}
                  className="rounded text-secondary focus:ring-secondary w-5 h-5 border-outline-variant"
                />
                <span className="text-sm">同時發送 Email 通知</span>
              </label>
              <p className="text-xs text-on-surfaceVariant px-2">
                僅在「立即發佈」且學生有填寫 Email 時寄送。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 底欄 */}
      {!isArchived && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant/30 bg-surface-containerLowest/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-4 md:px-8">
          <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-error hover:bg-error-container transition-colors font-bold text-sm"
            >
              捨棄變更
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void persist('draft')}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-bold text-sm disabled:opacity-50"
              >
                {isSubmitting ? '處理中…' : '儲存草稿'}
              </button>
              <button
                type="button"
                onClick={() => void persist(publishMode === 'schedule' ? 'schedule' : 'now')}
                disabled={isSubmitting || !form.title || !form.content}
                className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-colors shadow-sm font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <LoadingSpinner size={16} color="white" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
                {publishMode === 'schedule' ? '確認預定' : '確認發佈'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
