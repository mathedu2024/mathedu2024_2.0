'use client';

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import GradeScoreInput from './GradeScoreInput';

export type PeriodicScoreName = '第一次定期評量' | '第二次定期評量' | '期末評量';

type ColumnDetail = { type: string; name: string; date: string };

type StudentGradeRow = {
  id: string;
  studentId: string;
  name: string;
  regularScores: { [columnId: string]: number | undefined };
  periodicScores: { [name in PeriodicScoreName]?: number };
  regWeighted: number;
  pAvg: number;
  originalTotal: number;
  finalTotal: number;
  manualAdjust?: number;
};

interface Props {
  tab: 'regular' | 'periodic' | 'total';
  students: StudentGradeRow[];
  regularColumns: number;
  columnDetails: { [idx: number]: ColumnDetail };
  _periodicScores: string[];
  periodicColumnDetails?: Record<string, { name?: string; date?: string; type?: string }>;
  onUpdateRegularScore: (studentId: string, colIdx: number, value?: number) => void;
  _onUpdatePeriodicScore: (studentId: string, scoreName: string, value?: number) => void;
  onUpdateFinalScore: (studentId: string, value: string | number | undefined) => void;
  isArchived?: boolean;
  onEditColumn?: (kind: 'regular' | 'periodic', id: number | string) => void;
}

/** Enter：同欄位往下一列學生；Shift+Enter：往上一列 */
function handleGradeInputKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  colKey: string,
  rowIndex: number
) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  e.preventDefault();
  const direction = e.shiftKey ? -1 : 1;
  const next = document.querySelector<HTMLInputElement>(
    `input[data-grade-col="${CSS.escape(colKey)}"][data-grade-row="${rowIndex + direction}"]`
  );
  if (!next || next.disabled || next.readOnly) return;
  next.focus();
  next.select();
}

export default function GradeRegistrationMobile({
  tab,
  students,
  regularColumns,
  columnDetails,
  _periodicScores,
  periodicColumnDetails = {},
  onUpdateRegularScore,
  _onUpdatePeriodicScore,
  onUpdateFinalScore,
  isArchived = false,
  onEditColumn,
}: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [openPeriodicIdx, setOpenPeriodicIdx] = useState<number | null>(null);

  if (tab === 'regular') {
    return (
      <div className="md:hidden">
        {regularColumns === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
            尚無成績項目
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: regularColumns }).map((_, idx) => {
              const detail = columnDetails[idx];
              const isSetup = !!(detail?.name && detail?.date);
              const label = detail?.name?.trim() ? detail.name : (detail?.type ? `${detail.type}${idx + 1}` : `成績${idx + 1}`);
              const isOpen = openIdx === idx;

              return (
                <div
                  key={idx}
                  className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${
                    isOpen ? 'border-primary shadow-md ring-1 ring-primary/30' : 'border-gray-200 shadow-sm'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer gap-2"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isOpen ? 'bg-primary' : 'bg-gray-300'}`} />
                      <div className="flex flex-col min-w-0">
                        <span
                          className="font-bold text-gray-900 text-base truncate cursor-pointer hover:text-primary active:text-primary"
                          title={label}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditColumn?.('regular', idx);
                          }}
                        >
                          {label}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {detail?.type || '一般'} {detail?.date ? `• ${detail.date}` : '• (尚未設定)'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${isOpen ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                        {isOpen ? '登記中' : '點擊展開'}
                      </span>
                      {isOpen ? <ChevronUpIcon className="w-5 h-5 text-primary" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-primary/20 bg-primary/5">
                      <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                        {students.map((stu, rowIndex) => (
                          <div key={stu.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white transition-colors">
                            <div className="flex flex-col flex-shrink-0 min-w-0">
                              <span className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{stu.name}</span>
                              <span className="text-xs text-gray-500 font-mono">{stu.studentId}</span>
                            </div>
                            <div className="w-[100px] shrink-0">
                              <GradeScoreInput
                                data-grade-col={`m-reg-${idx}`}
                                data-grade-row={rowIndex}
                                className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-center text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow shadow-sm placeholder-gray-300 ${isArchived || !isSetup ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                                value={stu.regularScores?.[idx]}
                                disabled={isArchived || !isSetup}
                                onCommit={(num) => onUpdateRegularScore(stu.id, idx, num)}
                                onKeyDown={(e) => handleGradeInputKeyDown(e, `m-reg-${idx}`, rowIndex)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (tab === 'periodic') {
    return (
      <div className="md:hidden space-y-3">
        {_periodicScores.map((scoreName, idx) => {
          const isOpen = openPeriodicIdx === idx;
          const meta = periodicColumnDetails[scoreName];
          const isSetup = !!meta?.date;
          return (
            <div
              key={scoreName}
              className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${
                isOpen ? 'border-primary shadow-md ring-1 ring-primary/30' : 'border-gray-200 shadow-sm'
              }`}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer gap-2"
                onClick={() => setOpenPeriodicIdx(isOpen ? null : idx)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isOpen ? 'bg-primary' : 'bg-gray-300'}`} />
                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-bold text-gray-900 text-base truncate cursor-pointer hover:text-primary active:text-primary"
                      title={scoreName}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditColumn?.('periodic', scoreName);
                      }}
                    >
                      {scoreName}
                    </span>
                    {meta?.date ? (
                      <span className="text-xs text-gray-500 font-mono">{meta.date}</span>
                    ) : (
                      <span className="text-xs text-red-400 font-mono">(尚未設定)</span>
                    )}
                  </div>
                </div>
                {isOpen ? <ChevronUpIcon className="w-5 h-5 text-primary shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />}
              </div>

              {isOpen && (
                <div className="border-t border-primary/20 bg-primary/5">
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                    {students.map((stu, rowIndex) => (
                      <div key={stu.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white transition-colors">
                        <div className="flex flex-col flex-shrink-0 min-w-0">
                          <span className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{stu.name}</span>
                          <span className="text-xs text-gray-500 font-mono">{stu.studentId}</span>
                        </div>
                        <div className="w-[100px] shrink-0">
                          <GradeScoreInput
                            data-grade-col={`m-peri-${scoreName}`}
                            data-grade-row={rowIndex}
                            className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-center text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow shadow-sm placeholder-gray-300 ${isArchived || !isSetup ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                            value={stu.periodicScores?.[scoreName as PeriodicScoreName]}
                            disabled={isArchived || !isSetup}
                            onCommit={(num) => _onUpdatePeriodicScore(stu.id, scoreName, num)}
                            onKeyDown={(e) => handleGradeInputKeyDown(e, `m-peri-${scoreName}`, rowIndex)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (tab === 'total') {
    return (
      <div className="md:hidden space-y-3">
        {students.map((stu, rowIndex) => (
          <div key={stu.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-gray-50 gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold text-gray-900 truncate">{stu.name}</span>
                <span className="text-sm text-gray-500 font-mono">{stu.studentId}</span>
              </div>
              <div className="text-right shrink-0 w-[100px]">
                <span className="text-xs text-gray-400 block uppercase font-bold mb-1">最終成績</span>
                <GradeScoreInput
                  data-grade-col="m-final"
                  data-grade-row={rowIndex}
                  className={`w-full border rounded-xl px-2 py-2 text-center text-xl font-black focus:ring-2 focus:ring-primary outline-none ${stu.finalTotal < 60 ? 'text-red-600' : 'text-primary'} ${isArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  value={stu.manualAdjust !== undefined ? stu.manualAdjust : stu.finalTotal}
                  disabled={isArchived}
                  onCommit={(num) => onUpdateFinalScore(stu.id, num)}
                  onKeyDown={(e) => handleGradeInputKeyDown(e, 'm-final', rowIndex)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">平時加權</span>
                <span className="text-base font-bold text-gray-700 font-mono">{stu.regWeighted.toFixed(1)}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">定期平均</span>
                <span className="text-base font-bold text-gray-700 font-mono">{stu.pAvg.toFixed(1)}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">原始成績</span>
                <span className="text-base font-bold text-gray-700 font-mono">{stu.originalTotal}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
