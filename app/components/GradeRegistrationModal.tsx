// app/components/GradeRegistrationModal.tsx
import React from 'react';
import { Modal } from './ui'; // Assuming a Modal component exists in './ui'

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
            <div className="p-4">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">學號</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">姓名</th>
                            {columnsInGroup.map(({ colIdx, detail }) => (
                                <th key={colIdx} className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                                    {detail.name || `成績 ${colIdx + 1}`}
                                    {detail.date && <span className="text-gray-400 text-xs ml-1">({detail.date})</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {students.map((student) => (
                            <tr key={student.id}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{student.studentId}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                                {columnsInGroup.map(({ colIdx }) => (
                                    <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={student.regularScores[colIdx] ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                                onUpdateStudentGrade(student.id, colIdx, value);
                                            }}
                                            className="w-20 border rounded-md shadow-sm p-1 text-center"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-primary"
                    >
                        關閉
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GradeRegistrationModal;
