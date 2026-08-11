'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StudentExamListItem } from '@/utils/studentClientApi';
import StudentExamStartPanel from './StudentExamStartPanel';

interface StudentExamStartModalProps {
  open: boolean;
  onClose: () => void;
  exam: StudentExamListItem;
  studentId: string;
  mode?: 'start' | 'retake';
  resolveExamTitle?: (quizCode: string) => string | undefined;
  /** 作答結束後回程（通常為課程線上測驗分頁） */
  backHref?: string;
}

/** 僅供老師預覽等仍需彈窗的情境；學生端改走開始作答頁面 */
export default function StudentExamStartModal({
  open,
  onClose,
  exam,
  studentId,
  mode = 'start',
  backHref,
}: StudentExamStartModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <StudentExamStartPanel
        exam={exam}
        studentId={studentId}
        mode={mode}
        backHref={backHref}
        onCancel={onClose}
        variant="modal"
      />
    </div>,
    document.body
  );
}
