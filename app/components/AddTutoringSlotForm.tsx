import React, { useState } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';

interface AddTutoringSlotFormProps {
  onClose: () => void;
  onSave: (data: { grades: string[]; subjects: string[]; classes: string[] }) => void;
}

const gradeOptions = [
  { label: '國一', value: '國一' },
  { label: '國二', value: '國二' },
  { label: '國三', value: '國三' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' },
];

const subjectOptions = [
  { label: '數學', value: '數學' },
  { label: '英文', value: '英文' },
  { label: '物理', value: '物理' },
  { label: '化學', value: '化學' },
  { label: '生物', value: '生物' },
  { label: '國文', value: '國文' },
];

const classOptions = [
  { label: 'A班', value: 'A班' },
  { label: 'B班', value: 'B班' },
  { label: 'C班', value: 'C班' },
];

const AddTutoringSlotForm: React.FC<AddTutoringSlotFormProps> = ({ onClose, onSave }) => {
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ grades: selectedGrades, subjects: selectedSubjects, classes: selectedClasses });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">新增輔導時段</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <MultiSelectDropdown
            label="年級"
            options={gradeOptions}
            selectedOptions={selectedGrades}
            onChange={setSelectedGrades}
            placeholder="選擇年級"
          />
        </div>
        <div className="mb-4">
          <MultiSelectDropdown
            label="科目"
            options={subjectOptions}
            selectedOptions={selectedSubjects}
            onChange={setSelectedSubjects}
            placeholder="選擇科目"
          />
        </div>
        <div className="mb-4">
          <MultiSelectDropdown
            label="班級"
            options={classOptions}
            selectedOptions={selectedClasses}
            onChange={setSelectedClasses}
            placeholder="選擇班級"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            儲存
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTutoringSlotForm;
