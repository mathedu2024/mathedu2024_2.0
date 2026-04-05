'use client';

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

// Local PeriodicScoreName definition
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
  total: number;
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
              const label = detail?.name?.trim() ? detail.name : (detail?.type ? `${detail.type}${idx + 1}` : `成績${idx + 1}`);
              const isOpen = openIdx === idx;

              return (
                <div 
                  key={idx} 
                  className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${
                    isOpen ? 'border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 shadow-sm'
                  }`}
                >
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isOpen ? 'bg-indigo-500' : 'bg-gray-300'}`}></span>
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-bold text-gray-900 text-base truncate">{label}</span>
                            <span className="text-xs text-gray-500 truncate">{detail?.type || '一般'} {detail?.date ? `• ${detail.date}` : ''}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${isOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                            {isOpen ? '登記中' : '點擊展開'}
                        </span>
                        {isOpen ? <ChevronUpIcon className="w-5 h-5 text-indigo-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                  
                  {/* 展開學生輸入列 */}
                  {isOpen && (
                    <div className="border-t border-indigo-100 bg-indigo-50/30">
                      <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                        {students.map(stu => (
                          <div key={stu.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white transition-colors">
                            <div className="flex flex-col flex-shrink-0">
                               <span className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{stu.name}</span>
                               <span className="text-xs text-gray-500 font-mono">{stu.studentId}</span>
                            </div>
                            <div className="flex-1 max-w-[120px]">
                              <input
                                  inputMode="numeric"
                                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-center text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm placeholder-gray-300"
                                  placeholder="-"
                                  value={stu.regularScores?.[idx] ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    onUpdateRegularScore(stu.id, idx, v === '' ? undefined : parseInt(v, 10));
                                  }}
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
                 const title = scoreName;
                 return (
                    <div 
                        key={scoreName} 
                        className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${
                        isOpen ? 'border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 shadow-sm'
                        }`}
                    >
                        <div 
                            className="flex items-center justify-between p-4 cursor-pointer"
                            onClick={() => setOpenPeriodicIdx(isOpen ? null : idx)}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isOpen ? 'bg-indigo-500' : 'bg-gray-300'}`}></span>
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-base">{title}</span>
                                  {meta?.date ? (
                                    <span className="text-xs text-gray-500 font-mono">{meta.date}</span>
                                  ) : null}
                                </div>
                            </div>
                            {isOpen ? <ChevronUpIcon className="w-5 h-5 text-indigo-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                        </div>

                         {isOpen && (
                            <div className="border-t border-indigo-100 bg-indigo-50/30">
                                <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                                {students.map(stu => (
                                    <div key={stu.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white transition-colors">
                                    <div className="flex flex-col flex-shrink-0">
                                        <span className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{stu.name}</span>
                                        <span className="text-xs text-gray-500 font-mono">{stu.studentId}</span>
                                    </div>
                                    <div className="flex-1 max-w-[120px]">
                                        <input
                                            inputMode="numeric"
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-center text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm placeholder-gray-300"
                                            placeholder="-"
                                            value={stu.periodicScores?.[scoreName] ?? ''}
                                            onChange={e => {
                                              const v = e.target.value;
                                              _onUpdatePeriodicScore(stu.id, scoreName, v === '' ? undefined : parseInt(v, 10));
                                            }}
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
          {students.map(stu => (
            <div key={stu.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-50">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{stu.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{stu.studentId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">總成績</span>
                  <span className={`text-xl font-black ${stu.total < 60 ? 'text-red-600' : 'text-indigo-600'}`}>
                    {stu.total}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                  <span className="text-[10px] text-gray-500 block mb-1">平時加權</span>
                  <span className="text-sm font-bold text-gray-700 font-mono">{stu.regWeighted.toFixed(1)}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                  <span className="text-[10px] text-gray-500 block mb-1">定期平均</span>
                  <span className="text-sm font-bold text-gray-700 font-mono">{stu.pAvg.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
  }

  return null;
}