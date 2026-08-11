'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SiteTeacher } from '@/data/siteTeachers';

type Props = {
  teacher: SiteTeacher | null;
  open: boolean;
  onClose: () => void;
};

export default function SiteTeacherDetailModal({ teacher, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !teacher || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${teacher.name}介紹`}
        className="relative bg-surface-containerLowest rounded-2xl shadow-2xl w-full max-w-3xl max-h-full sm:h-[90vh] overflow-hidden flex flex-col animate-bounce-in"
      >
        <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-bold">{teacher.name}</h2>
            <p className="text-xs text-primary-fixed font-medium">{teacher.subject}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20"
            aria-label="關閉"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-8">
            {teacher.introduction?.trim() && (
              <div className="bg-surface rounded-xl p-5 border border-outline-variant/40">
                <h4 className="flex items-center font-display text-lg font-bold text-on-surface mb-3">
                  <i className="fas fa-user text-primary mr-2" /> 自我介紹
                </h4>
                <p className="text-on-surfaceVariant text-sm leading-relaxed whitespace-pre-line">
                  {teacher.introduction.trim()}
                </p>
              </div>
            )}

            <div className="bg-surface rounded-xl p-5 border border-outline-variant/40">
              <h4 className="flex items-center font-display text-lg font-bold text-on-surface mb-3">
                <i className="fas fa-graduation-cap text-primary mr-2" /> 學歷
              </h4>
              <ul className="space-y-2">
                {teacher.education.map((edu, i) => (
                  <li key={i} className="flex items-start text-on-surface text-sm">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 mr-2 shrink-0" />
                    {edu}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="flex items-center font-display text-lg font-bold text-on-surface mb-3 border-l-4 border-primary pl-3">
                經歷
              </h4>
              <ul className="space-y-3">
                {teacher.experience.map((exp, i) => (
                  <li
                    key={i}
                    className="text-on-surface text-sm leading-relaxed border-b border-outline-variant/30 pb-2 last:border-0 last:pb-0"
                  >
                    {exp}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="flex items-center font-display text-lg font-bold text-on-surface mb-3 border-l-4 border-secondary pl-3">
                  專長
                </h4>
                <div className="flex flex-wrap gap-2">
                  {teacher.expertise.map((item, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-secondary-container/40 text-secondary text-sm rounded-lg border border-secondary/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="flex items-center font-display text-lg font-bold text-on-surface mb-3 border-l-4 border-tertiary pl-3">
                  授課課程
                </h4>
                <ul className="space-y-1">
                  {teacher.courses.map((course, i) => (
                    <li key={i} className="flex items-center text-on-surface text-sm">
                      <i className="fas fa-check text-secondary mr-2 text-xs" />
                      {course}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-outline-variant/40 flex justify-end bg-surface/50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-surface-containerLowest border border-outline-variant text-on-surface rounded-xl hover:bg-surface-container font-medium transition-colors shadow-sm"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
