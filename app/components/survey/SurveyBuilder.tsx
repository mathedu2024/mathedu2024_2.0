'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CloudArrowUpIcon,
  Cog6ToothIcon,
  DocumentCheckIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import { btnStyles, btnWithIconStyle } from '@/components/ui';
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
        await Swal.fire({ icon: 'warning', title: err, confirmButtonColor: '#4f46e5' });
        return;
      }
    }
    if (!toSave.title.trim()) {
      await Swal.fire({ icon: 'warning', title: '請填寫問卷標題', confirmButtonColor: '#4f46e5' });
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
        confirmButtonColor: '#4f46e5',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '儲存失敗',
        confirmButtonColor: '#4f46e5',
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
          confirmButtonColor: '#4f46e5',
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
          confirmButtonColor: '#4f46e5',
        });
      }
    };

    onToolbarChange(
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={openPreview}
          className={btnWithIconStyle(btnStyles.secondary)}
        >
          <EyeIcon className="w-4 h-4 mr-2" />
          學生版預覽
        </button>
        {survey.status === 'published' ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSurvey('published')}
            className={btnWithIconStyle(btnStyles.primary)}
          >
            <CloudArrowUpIcon className="w-4 h-4 mr-2" />
            儲存
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSurvey('draft')}
              className={btnWithIconStyle(btnStyles.secondary)}
            >
              <DocumentCheckIcon className="w-4 h-4 mr-2" />
              儲存
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSurvey('published')}
              className={btnWithIconStyle(btnStyles.primary)}
            >
              <CloudArrowUpIcon className="w-4 h-4 mr-2" />
              開放問卷
            </button>
          </>
        )}
      </div>
    );
    return () => onToolbarChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, survey.status, survey.title, survey.sections, survey.responseMode, survey.answerWindowEnabled, survey.answerStartAt, survey.answerEndAt, survey.responsesVisibleToStudents]);

  return (
    <div className="space-y-6">
      {survey.status === 'published' && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>
            此問卷目前<strong>開放</strong>給學生。點「<strong>儲存</strong>」只會更新內容，不會改為隱藏。
          </p>
          <button
            type="button"
            onClick={() => void saveSurvey('draft')}
            disabled={saving}
            className="shrink-0 text-red-600 hover:text-red-700 text-sm font-medium underline-offset-2 hover:underline disabled:opacity-50"
          >
            改為隱藏
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              survey.status === 'published'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {survey.status === 'published' ? '開放' : '隱藏'}
          </span>
          <span>{formatSurveyResponseMode(survey.responseMode)}</span>
          <span>{countSurveyQuestions(survey)} 題</span>
          {isDirty && <span className="text-amber-600">尚未儲存</span>}
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-700">問卷標題</span>
          <input
            type="text"
            value={survey.title}
            onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="例如：期末課程滿意度調查"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-700">說明（選填）</span>
          <textarea
            value={survey.description ?? ''}
            onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="學生填寫前會看到的說明文字"
          />
        </label>

        <div className="pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold text-gray-800">詳細設定摘要</h3>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Cog6ToothIcon className="w-4 h-4 mr-1.5" />
              開啟詳細設定
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 shrink-0">填答模式</dt>
              <dd className="text-gray-800">{formatSurveyResponseMode(survey.responseMode)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 shrink-0">填答期間</dt>
              <dd className="text-gray-800">{formatSurveyAnswerWindow(survey)}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="text-gray-500 shrink-0">學生查看</dt>
              <dd className="text-gray-800">
                {isSurveyResponsesVisibleToStudents(survey) ? '允許查看自己的填答' : '不可查看填答'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <SurveySettingsModal
        open={settingsOpen}
        survey={survey}
        onChange={setSurvey}
        onClose={() => setSettingsOpen(false)}
      />

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
  );
}
