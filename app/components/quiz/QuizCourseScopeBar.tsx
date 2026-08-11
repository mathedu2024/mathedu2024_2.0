'use client';

import React from 'react';
import type { QuizCourseScopeOption } from '@/services/quizTeacherAccess';

interface QuizCourseScopeBarProps {
  scopes: QuizCourseScopeOption[];
  value: string;
  onChange: (scopeId: string) => void;
  label?: string;
}

export default function QuizCourseScopeBar({
  scopes,
  value,
  onChange,
  label = '分析範圍',
}: QuizCourseScopeBarProps) {
  if (scopes.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {scopes.map((scope) => (
          <button
            key={scope.id}
            type="button"
            onClick={() => onChange(scope.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              value === scope.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {scope.label}
          </button>
        ))}
      </div>
    </div>
  );
}
