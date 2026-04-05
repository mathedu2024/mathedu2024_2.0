'use client';

import React from 'react';

// Local Modal to ensure consistent Indigo styling without external dependencies
const Modal = ({ 
  open, 
  onClose, 
  title, 
  size = 'md', 
  children 
}: { 
  open: boolean; 
  onClose: () => void; 
  title: string; 
  size?: 'md' | 'lg' | 'xl'; 
  children: React.ReactNode 
}) => {
  if (!open) return null;
  
  const maxWidthClass = {
    md: 'max-w-lg',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  }[size];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto animate-bounce-in border border-gray-100 flex flex-col`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ColumnDetail {
    type: string;
    name: string;
    date: string;
}

type PeriodicScoreName = '第一次定期評量' | '第二次定期評量' | '期末評量';

interface StudentGradeRow {
    id: string;
    studentId: string;
    name: string;
    grade: string;
    regularScores: { [columnId: string]: number | undefined };
    periodicScores: { [name in PeriodicScoreName]?: number };
    totalScore: number;
    manualAdjust: number;
    remark?: string;
}

interface GradeRegistrationModalProps {
    open: boolean;
    onClose: () => void;
    groupType: '小考' | '作業' | '上課態度' | null;
    students: StudentGradeRow[];
    columnDetails: { [idx: number]: ColumnDetail };
    onUpdateStudentGrade: (studentId: string, colIdx: number, value: number | undefined) => void;
}

const GradeRegistrationModal: React.FC<GradeRegistrationModalProps> = ({
    open,
    onClose,
    groupType,
    students,
    columnDetails,
    onUpdateStudentGrade,
}) => {
    if (!open || !groupType) return null;

    const columnsInGroup = Object.entries(columnDetails)
        .filter(([, detail]) => detail.type === groupType)
        .map(([colIdx, detail]) => ({ colIdx: Number(colIdx), detail }));

    return (
        <Modal open={open} onClose={onClose} title={`${groupType} 成績登記`} size="xl">
            <div className="p-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">學號</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-20 bg-gray-50 z-10">姓名</th>
                                {columnsInGroup.map(({ colIdx, detail }) => (
                                    <th key={colIdx} className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">
                                        <div className="flex flex-col items-center">
                                            <span>{detail.name || `成績 ${colIdx + 1}`}</span>
                                            {detail.date && <span className="text-gray-400 text-[10px] mt-0.5 font-normal">{detail.date}</span>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {students.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 font-mono sticky left-0 bg-white group-hover:bg-gray-50">{student.studentId}</td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-20 bg-white group-hover:bg-gray-50">{student.name}</td>
                                    {columnsInGroup.map(({ colIdx }) => (
                                        <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={student.regularScores[colIdx] ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        onUpdateStudentGrade(student.id, colIdx, undefined);
                                                        return;
                                                    }
                                                    const numVal = parseInt(val, 10);
                                                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
                                                        onUpdateStudentGrade(student.id, colIdx, numVal);
                                                    }
                                                }}
                                                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                                                placeholder="--"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        完成登記
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GradeRegistrationModal;