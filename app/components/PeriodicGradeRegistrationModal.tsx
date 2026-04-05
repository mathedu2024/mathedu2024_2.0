'use client';

import React from 'react';

// Local Modal Component to ensure consistent styling
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

interface PeriodicGradeRegistrationModalProps {
    open: boolean;
    onClose: () => void;
    periodicType: PeriodicScoreName | null;
    students: StudentGradeRow[];
    onUpdatePeriodicStudentGrade: (studentId: string, periodicType: PeriodicScoreName, value: number | undefined) => void;
}

const PeriodicGradeRegistrationModal: React.FC<PeriodicGradeRegistrationModalProps> = ({
    open,
    onClose,
    periodicType,
    students,
    onUpdatePeriodicStudentGrade,
}) => {
    if (!open || !periodicType) return null;

    return (
        <Modal open={open} onClose={onClose} title={`${periodicType} 成績登記`} size="xl">
            <div className="p-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">學號</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">姓名</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{periodicType}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {students.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">
                                        {student.studentId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {student.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="relative max-w-xs">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={student.periodicScores?.[periodicType] ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    // Allow empty string for clearing
                                                    if (val === '') {
                                                        onUpdatePeriodicStudentGrade(student.id, periodicType, undefined);
                                                        return;
                                                    }
                                                    const numVal = parseInt(val, 10);
                                                    // Validate input range immediately or just pass value
                                                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
                                                        onUpdatePeriodicStudentGrade(student.id, periodicType, numVal);
                                                    }
                                                }}
                                                className="block w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center font-mono"
                                                placeholder="--"
                                            />
                                        </div>
                                    </td>
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

export default PeriodicGradeRegistrationModal;