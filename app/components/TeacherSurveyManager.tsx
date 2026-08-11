'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import BackButton from '@/components/ui/BackButton';
import SurveyBuilder from '@/components/survey/SurveyBuilder';
import SurveyAnalyticsPanel from '@/components/survey/SurveyAnalyticsPanel';
import type { Course } from '@/components/TeacherCourseManager';
import type { Survey } from '@/services/surveyTypes';
import {
  createEmptySurveySection,
  ensureSurveySections,
  generateSurveyCode,
} from '@/services/surveyTypes';
import { resolveReturnTo, teacherCourseHubPath, withReturnTo } from '@/utils/teacherCourseHub';
import { surveyDetailPath } from '@/utils/surveyRoutes';
import {
  fetchSurveyByCode,
  invalidateTeacherSurveys,
  invalidateSurveyByCode,
} from '@/utils/teacherClientApi';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

type SurveySubView = '' | 'new' | 'builder' | 'analytics';

interface TeacherSurveyManagerProps {
  userInfo?: UserInfo | null;
  courses?: Course[];
  surveyCodeFromUrl?: string;
  surveySubView?: SurveySubView;
  initialCourseId?: string;
}

const SURVEY_FALLBACK_PATH = '/back-panel/teacher-courses';

function createEmptySurvey(
  teacherId: string,
  assignedCourse?: { courseId: string; courseName: string }
): Survey {
  return ensureSurveySections({
    id: '',
    surveyCode: generateSurveyCode(),
    teacherId,
    title: '',
    description: '',
    status: 'draft',
    sections: [createEmptySurveySection(0)],
    responseMode: 'named',
    answerWindowEnabled: false,
    attemptLimit: 1,
    responsesVisibleToStudents: true,
    assignedCourses: assignedCourse ? [assignedCourse] : [],
  });
}

export default function TeacherSurveyManager({
  userInfo,
  courses = [],
  surveyCodeFromUrl = '',
  surveySubView = '',
  initialCourseId = '',
}: TeacherSurveyManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get('returnTo');
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [builderToolbar, setBuilderToolbar] = useState<React.ReactNode>(null);

  const surveysHubReturnTo = useMemo(() => {
    if (returnToParam) return resolveReturnTo(returnToParam, SURVEY_FALLBACK_PATH);
    if (!initialCourseId) return SURVEY_FALLBACK_PATH;
    const course = courses.find((c) => c.id === initialCourseId || c.code === initialCourseId);
    if (!course?.code) return SURVEY_FALLBACK_PATH;
    return teacherCourseHubPath(course.code, 'surveys');
  }, [returnToParam, initialCourseId, courses]);

  const backLabel = surveysHubReturnTo.startsWith('/back-panel/teacher-courses/')
    ? '返回課程問卷'
    : '返回授課管理';

  useEffect(() => {
    if (!surveySubView) {
      setEditingSurvey(null);
      setDetailLoading(false);
      return;
    }

    if (surveySubView === 'new') {
      if (!userInfo?.id) return;
      const course = initialCourseId
        ? courses.find((c) => c.id === initialCourseId || c.code === initialCourseId)
        : undefined;
      setEditingSurvey(
        createEmptySurvey(
          userInfo.id,
          course
            ? { courseId: course.id, courseName: `${course.name}（${course.code}）` }
            : undefined
        )
      );
      setDetailLoading(false);
      return;
    }

    if (!surveyCodeFromUrl) return;

    let cancelled = false;
    setDetailLoading(true);
    void fetchSurveyByCode(surveyCodeFromUrl)
      .then((survey) => {
        if (!cancelled) setEditingSurvey(ensureSurveySections(survey));
      })
      .catch(() => {
        if (!cancelled) {
          void Swal.fire({ icon: 'error', title: '載入失敗', confirmButtonColor: '#4f46e5' });
          router.push(surveysHubReturnTo);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    surveySubView,
    surveyCodeFromUrl,
    userInfo?.id,
    router,
    initialCourseId,
    courses,
    surveysHubReturnTo,
  ]);

  const handleSaved = useCallback(
    (survey: Survey) => {
      if (userInfo?.id) invalidateTeacherSurveys(userInfo.id);
      invalidateSurveyByCode(survey.surveyCode);
      setEditingSurvey(survey);
      if (surveySubView === 'new' && survey.surveyCode) {
        router.replace(
          withReturnTo(
            surveyDetailPath(survey.surveyCode),
            surveysHubReturnTo !== SURVEY_FALLBACK_PATH ? surveysHubReturnTo : null
          )
        );
      }
    },
    [userInfo?.id, surveySubView, router, surveysHubReturnTo]
  );

  const title =
    surveySubView === 'analytics'
      ? '問卷分析'
      : surveySubView === 'new' || surveySubView === 'builder'
        ? editingSurvey?.id
          ? '編輯問卷'
          : '建立問卷'
        : '課程問卷';

  const subtitle =
    surveySubView === 'analytics'
      ? `${editingSurvey?.title || '未命名問卷'} · 統計分析與個別填答。`
      : '設定題目、記名／不記名與填答期間；開放後學生即可填寫。';

  if (!surveySubView) {
    return null;
  }

  return (
    <div className="page-shell w-full min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600" />
            {title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4 mb-6">
        <BackButton
          label={backLabel}
          onClick={() => router.push(surveysHubReturnTo)}
          withSpacing={false}
        />
        {builderToolbar}
      </div>

      {detailLoading || !editingSurvey ? (
        <div className="min-h-[280px] flex items-center justify-center">
          <PageLoadingArea />
        </div>
      ) : surveySubView === 'analytics' ? (
        userInfo?.id ? (
          <SurveyAnalyticsPanel survey={editingSurvey} teacherId={userInfo.id} />
        ) : null
      ) : (
        <SurveyBuilder
          survey={editingSurvey}
          courses={courses}
          onBack={() => router.push(surveysHubReturnTo)}
          onSaved={handleSaved}
          onToolbarChange={setBuilderToolbar}
        />
      )}
    </div>
  );
}
