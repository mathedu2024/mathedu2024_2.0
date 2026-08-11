'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CloudArrowUpIcon,
  Cog6ToothIcon,
  DocumentCheckIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import SurveyQuestionsEditor from './SurveyQuestionsEditor';
import SurveySettingsModal from './SurveySettingsModal';
import type { Course } from '@/components/TeacherCourseManager';
import type { Survey } from '@/services/surveyTypes';
import {
  ensureSurveySections,
  validateSurveyForPublish,
  formatSurveyResponseMode,
  formatSurveyAnswerWindow,
  countSurveyQuestions,
  isSurveyResponsesVisibleToStudents,
  isSurveyAnonymous,
} from '@/services/surveyTypes';
import {
  openBlankPreviewTab,
  openTeacherSurveyPreviewInNewTab,
} from '@/utils/teacherSurveyPreview';

interface SurveyBuilderProps {
  survey: Survey;
  courses: Course[];
  onBack: () => void;
  onSaved: (survey: Survey) => void;
  onToolbarChange?: (toolbar: React.ReactNode) => void;
}

export default function SurveyBuilder({
  survey: initialSurvey,
  onSaved,
  onToolbarChange,
}: SurveyBuilderProps) {
  const [survey, setSurvey] = useState<Survey>(() => ensureSurveySections(initialSurvey));
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const savedSnapshotRef = useRef('');

  useEffect(() => {
    const next = ensureSurveySections(initialSurvey);
    setSurvey(next);
    savedSnapshotRef.current = JSON.stringify(next);
  }, [initialSurvey]);

  const isDirty = JSON.stringify(survey) !== savedSnapshotRef.current;

  const saveSurvey = async (status: 'draft' | 'published') => {
    const toSave: Survey = {
      ...survey,
      answerWindowEnabled: !!survey.answerWindowEnabled,
      answerStartAt: survey.answerWindowEnabled ? survey.answerStartAt : undefined,
      answerEndAt: survey.answerWindowEnabled ? survey.answerEndAt : undefined,
    };

    if (status === 'published') {
      const err = validateSurveyForPublish({ ...toSave, status });
      if (err) {
        await Swal.fire({ icon: 'warning', title: err, confirmButtonColor: '#2D6DF6' });
        return;
      }
    }
    if (!toSave.title.trim()) {
      await Swal.fire({ icon: 'warning', title: '請填寫問卷標題', confirmButtonColor: '#2D6DF6' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...toSave,
        status,
        title: toSave.title.trim(),
        description: toSave.description?.trim() ?? '',
        answerWindowEnabled: !!toSave.answerWindowEnabled,
        answerStartAt: toSave.answerWindowEnabled ? toSave.answerStartAt : undefined,
        answerEndAt: toSave.answerWindowEnabled ? toSave.answerEndAt : undefined,
        responsesVisibleToStudents: toSave.responsesVisibleToStudents !== false,
      };

      let surveyId = toSave.id;
      let surveyCode = toSave.surveyCode;

      if (!surveyId) {
        const res = await fetch('/api/surveys/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '建立失敗');
        surveyId = data.surveyId;
        surveyCode = data.surveyCode;
      } else {
        const res = await fetch('/api/surveys/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surveyId,
            teacherId: toSave.teacherId,
            ...payload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '儲存失敗');
      }

      const next = ensureSurveySections({
        ...toSave,
        id: surveyId,
        surveyCode,
        status,
      });
      savedSnapshotRef.current = JSON.stringify(next);
      setSurvey(next);
      onSaved(next);
      await Swal.fire({
        icon: 'success',
        title: status === 'published' && survey.status !== 'published' ? '已開放給學生' : '已儲存',
        confirmButtonColor: '#2D6DF6',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '儲存失敗',
        confirmButtonColor: '#2D6DF6',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!onToolbarChange) return;

    const openPreview = () => {
      if (countSurveyQuestions(survey) === 0) {
        void Swal.fire({
          icon: 'info',
          title: '尚無題目',
          text: '請先新增至少一題再預覽學生填寫畫面。',
          confirmButtonColor: '#2D6DF6',
        });
        return;
      }
      const blank = openBlankPreviewTab();
      try {
        openTeacherSurveyPreviewInNewTab(survey, { targetWindow: blank });
      } catch (error) {
        blank?.close();
        void Swal.fire({
          icon: 'error',
          title: error instanceof Error ? error.message : '無法開啟預覽',
          confirmButtonColor: '#2D6DF6',
        });
      }
    };

    onToolbarChange(
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={openPreview}
          className="inline-flex items-center px-4 py-2 border border-primary/20 text-primary rounded-xl hover:bg-primary/5 transition-colors font-bold text-sm disabled:opacity-50"
        >
          <EyeIcon className="w-4 h-4 mr-1.5" />
          預覽
        </button>
        {survey.status === 'published' ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSurvey('published')}
            className="inline-flex items-center px-5 py-2 bg-primary-container text-on-primary rounded-xl hover:bg-primary transition-colors shadow-sm font-bold text-sm disabled:opacity-50"
          >
            <CloudArrowUpIcon className="w-4 h-4 mr-1.5" />
            儲存
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSurvey('draft')}
              className="inline-flex items-center px-4 py-2 border border-outline-variant text-on-surface rounded-xl hover:bg-surface-containerLow transition-colors font-medium text-sm disabled:opacity-50"
            >
              <DocumentCheckIcon className="w-4 h-4 mr-1.5" />
              儲存草稿
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSurvey('published')}
              className="inline-flex items-center px-5 py-2 bg-primary-container text-on-primary rounded-xl hover:bg-primary transition-colors shadow-sm font-bold text-sm disabled:opacity-50"
            >
              <CloudArrowUpIcon className="w-4 h-4 mr-1.5" />
              發佈問卷
            </button>
          </>
        )}
      </div>
    );
    return () => onToolbarChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saving,
    survey.status,
    survey.title,
    survey.sections,
    survey.responseMode,
    survey.answerWindowEnabled,
    survey.answerStartAt,
    survey.answerEndAt,
    survey.responsesVisibleToStudents,
  ]);

  const audienceLabel =
    (survey.assignedCourses || [])
      .map((c) => c.courseName)
      .filter(Boolean)
      .join('、') || '本課程學生';

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-8">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {survey.status === 'published' && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-on-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p>
              此問卷目前<strong>開放</strong>給學生。點「<strong>儲存</strong>」只會更新內容，不會改為隱藏。
            </p>
            <button
              type="button"
              onClick={() => void saveSurvey('draft')}
              disabled={saving}
              className="shrink-0 text-error text-sm font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              改為隱藏
            </button>
          </div>
        )}

        <div className="bg-surface-containerLowest rounded-xl shadow-sm p-6 border border-outline-variant/30 relative group">
          <div className="absolute -left-1 top-6 bottom-6 w-1 bg-primary rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-wrap items-center gap-2 text-sm text-on-surfaceVariant mb-3">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                survey.status === 'published'
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-surface-containerHigh text-on-surfaceVariant border border-dashed border-outline-variant'
              }`}
            >
              {survey.status === 'published' ? '已發佈' : '草稿'}
            </span>
            <span>{formatSurveyResponseMode(survey.responseMode)}</span>
            <span>{countSurveyQuestions(survey)} 題</span>
            {isDirty && <span className="text-amber-600">尚未儲存</span>}
          </div>
          <input
            type="text"
            value={survey.title}
            onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
            className="w-full text-2xl md:text-[28px] font-bold text-on-surface border-0 border-b-2 border-transparent hover:border-outline-variant focus:border-primary focus:ring-0 bg-transparent px-0 py-2 mb-2 placeholder:text-outline outline-none transition-colors"
            placeholder="問卷標題"
          />
          <textarea
            value={survey.description ?? ''}
            onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
            className="w-full text-base text-on-surfaceVariant border-0 hover:bg-surface-containerLow/50 focus:bg-surface-containerLow/50 rounded-lg focus:ring-0 resize-none min-h-[88px] p-3 outline-none transition-colors"
            placeholder="請輸入問卷說明或指示（選填）"
          />
        </div>

        <SurveyQuestionsEditor
          questions={survey.sections[0]?.questions ?? []}
          onChange={(questions) =>
            setSurvey({
              ...survey,
              sections: [
                {
                  id: survey.sections[0]?.id ?? 'main',
                  title: '',
                  description: '',
                  questions,
                },
              ],
            })
          }
        />
      </div>

      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
        <div className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden lg:sticky lg:top-4">
          <div className="bg-surface-containerLow px-5 py-4 border-b border-outline-variant/40">
            <h2 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
              <Cog6ToothIcon className="w-5 h-5 text-primary" />
              問卷設定
            </h2>
          </div>
          <div className="p-5 flex flex-col gap-5">
            <div>
              <label className="font-bold text-sm text-on-surface block mb-2">回收對象</label>
              <input
                type="text"
                readOnly
                value={audienceLabel}
                className="w-full rounded-lg border border-outline-variant text-sm text-on-surfaceVariant bg-surface-containerLow px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="font-bold text-sm text-on-surface block">匿名設定</label>
                <span className="text-xs text-on-surfaceVariant">允許學生不具名填寫</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isSurveyAnonymous(survey)}
                onClick={() =>
                  setSurvey({
                    ...survey,
                    responseMode: isSurveyAnonymous(survey) ? 'named' : 'anonymous',
                  })
                }
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                  isSurveyAnonymous(survey) ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isSurveyAnonymous(survey) ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <hr className="border-outline-variant/40" />

            <div>
              <label className="font-bold text-sm text-on-surface block mb-2">填答期間</label>
              <p className="text-sm text-on-surfaceVariant">{formatSurveyAnswerWindow(survey)}</p>
            </div>

            <div>
              <label className="font-bold text-sm text-on-surface block mb-2">學生查看</label>
              <p className="text-sm text-on-surfaceVariant">
                {isSurveyResponsesVisibleToStudents(survey)
                  ? '允許查看自己的填答'
                  : '不可查看填答'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-colors"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              開啟詳細設定
            </button>
          </div>
        </div>
      </aside>

      <SurveySettingsModal
        open={settingsOpen}
        survey={survey}
        onChange={setSurvey}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
