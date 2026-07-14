'use client';

import React, { createContext, useContext } from 'react';
import type { QuizImageUploadParams } from '@/utils/quizImageUpload';

const QuizImageContext = createContext<QuizImageUploadParams | null>(null);

export function QuizImageProvider({
  value,
  children,
}: {
  value: QuizImageUploadParams;
  children: React.ReactNode;
}) {
  return <QuizImageContext.Provider value={value}>{children}</QuizImageContext.Provider>;
}

export function useQuizImageContext(): QuizImageUploadParams | null {
  return useContext(QuizImageContext);
}
