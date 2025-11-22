// app/components/PeriodicGradeRegistrationModal.tsx
import React from 'react';
import { Modal } from './ui';



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
            <div className="p-4">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">學號</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">姓名</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">{periodicType}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {students.map((student) => (
                            <tr key={student.id}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{student.studentId}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={student.periodicScores?.[periodicType] ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                            onUpdatePeriodicStudentGrade(student.id, periodicType, value);
                                        }}
                                        className="w-20 border rounded-md shadow-sm p-1 text-center"
                                    />
                                </td>
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

export default PeriodicGradeRegistrationModal;
