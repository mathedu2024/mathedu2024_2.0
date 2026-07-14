'use client';

import { useEffect } from 'react';
import { useQuizStore } from '@/stores/useQuizStore';
import { isQuizExamLockEnabled, isQuizRequireFullscreen } from '@/services/quizTypes';
import { shouldKeepDraftOnVoluntaryExit } from '@/utils/examDraftPolicy';
import {
  clearTakeActiveSession,
  setTakeActiveSession,
  takeActiveHeartbeatIntervalMs,
} from '@/utils/examDraftStorage';
import { attachExamFullscreenGuards } from '@/utils/examFullscreen';

/** 作答期間：一律暫存草稿；依設定啟用禁止離開、全螢幕 */
export function useExamSessionGuards(): void {
  const quiz = useQuizStore((s) => s.quiz);
  const quizCode = useQuizStore((s) => s.quizCode);
  const studentId = useQuizStore((s) => s.studentId);
  const readOnly = useQuizStore((s) => s.readOnly);
  const previewMode = useQuizStore((s) => s.previewMode);
  const persistDraft = useQuizStore((s) => s.persistDraft);
  const abandonVoluntaryExit = useQuizStore((s) => s.abandonVoluntaryExit);

  const inactive = readOnly || previewMode;
  const lockEnabled = !!quiz && !inactive && isQuizExamLockEnabled(quiz);
  const fullscreenEnabled = !!quiz && !inactive && isQuizRequireFullscreen(quiz);
  const keepDraftOnExit = !!quiz && !inactive && shouldKeepDraftOnVoluntaryExit(quiz);

  // 不論老師是否啟用「禁止離開」，作答中一律定期與離頁時暫存
  useEffect(() => {
    if (inactive) return;

    const saveDraft = () => persistDraft();

    const interval = window.setInterval(saveDraft, 10_000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveDraft();
    };
    const onPageHide = () => saveDraft();
    const onBeforeUnloadSave = () => saveDraft();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnloadSave);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnloadSave);
    };
  }, [inactive, persistDraft]);

  // 僅在啟用「禁止離開」時阻擋離頁與瀏覽器返回
  useEffect(() => {
    if (!lockEnabled) return;

    const onBeforeUnloadBlock = (e: BeforeUnloadEvent) => {
      persistDraft();
      e.preventDefault();
      e.returnValue = '';
    };

    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('beforeunload', onBeforeUnloadBlock);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnloadBlock);
      window.removeEventListener('popstate', onPopState);
    };
  }, [lockEnabled, persistDraft]);

  // 非全螢幕、未鎖定：瀏覽器返回視為主動離開，清除暫存
  useEffect(() => {
    if (inactive || !quiz || keepDraftOnExit) return;

    const onPopState = () => {
      abandonVoluntaryExit();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [inactive, quiz, keepDraftOnExit, abandonVoluntaryExit]);

  useEffect(() => {
    if (!fullscreenEnabled) return;
    return attachExamFullscreenGuards();
  }, [fullscreenEnabled]);

  // 跨分頁標記進行中的作答分頁（心跳更新，關閉分頁後自動過期）
  useEffect(() => {
    if (inactive || !studentId || !quizCode) return;

    const beat = () => setTakeActiveSession(studentId, quizCode);
    beat();

    const interval = window.setInterval(beat, takeActiveHeartbeatIntervalMs());
    const onPageHide = () => beat();

    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      clearTakeActiveSession(studentId);
    };
  }, [inactive, studentId, quizCode]);
}
