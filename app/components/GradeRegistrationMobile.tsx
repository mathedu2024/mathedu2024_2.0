"use client";

import React, { useState } from 'react';

// Local PeriodicScoreName definition (keep file standalone)
export type PeriodicScoreName = '第一次定期評量' | '第二次定期評量' | '期末評量';

type ColumnDetail = { type: string; name: string; date: string };

type StudentGradeRow = {
  id: string;
  studentId: string;
  name: string;
  regularScores: { [columnId: string]: number | undefined };
  periodicScores: { [name in PeriodicScoreName]?: number };
  manualAdjust?: number;
};

interface Props {
  tab: 'regular' | 'periodic' | 'total';
  students: StudentGradeRow[];
  regularColumns: number;
  columnDetails: { [idx: number]: ColumnDetail };
  _periodicScores: PeriodicScoreName[];
  onUpdateRegularScore: (studentId: string, colIdx: number, value?: number) => void;
  _onUpdatePeriodicScore: (studentId: string, scoreName: PeriodicScoreName, value?: number) => void;
  _onUpdateManualAdjust: (studentId: string, value: number) => void;
}


export default function GradeRegistrationMobile({
  tab,
  students,
  regularColumns,
  columnDetails,
  _periodicScores,
  onUpdateRegularScore,
  _onUpdatePeriodicScore,
  _onUpdateManualAdjust,
}: Props) {
  // 展開狀態: key=regular col idx, value=boolean
  const [openIdx, setOpenIdx] = useState<number|null>(null);

  // 只針對 regular tab 實作新結構
  if (tab !== 'regular') return null;

  // 成績項目卡片
  return (
    <div className="md:hidden">
      {regularColumns === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500">尚無成績項目</div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: regularColumns }).map((_, idx) => {
            const detail = columnDetails[idx];
            const label = detail?.name?.trim() ? detail.name : (detail?.type ? `${detail.type}${idx + 1}` : `成績${idx + 1}`);
            return (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex flex-col items-stretch p-4 gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-gray-900 text-base flex-1 truncate">{label}</div>
                    <button className="text-blue-600 border border-blue-200 rounded px-2 py-1 text-xs font-medium" type="button">成績設定</button>
                    <button
                      className="text-white bg-blue-600 rounded px-3 py-1 text-xs font-medium"
                      type="button"
                      onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                    >{openIdx === idx ? '收合' : '登記成績'}</button>
                  </div>
                </div>
                {/* 展開學生輸入列 */}
                {openIdx === idx && (
                  <div className="border-t border-gray-100 bg-blue-50 transition-all duration-300">
                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-200">
                      {students.map(stu => (
                        <div key={stu.id} className="flex items-center gap-2 px-3 py-2">
                          <div className="w-16 text-xs text-gray-500 flex-shrink-0">{stu.studentId}</div>
                          <div className="flex-1 text-xs text-gray-800 truncate">{stu.name}</div>
                          <input
                            inputMode="numeric"
                            className="w-full border rounded px-2 py-2 text-center text-base bg-white"
                            style={{ minHeight: 44 }}
                            value={stu.regularScores?.[idx] ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              onUpdateRegularScore(stu.id, idx, v === '' ? undefined : parseInt(v, 10));
                            }}
                          />
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
