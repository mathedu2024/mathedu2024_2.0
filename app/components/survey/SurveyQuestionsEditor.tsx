'use client';

import React from 'react';
import { PlusIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import Dropdown from '../ui/Dropdown';
import type {
  SurveyChoiceQuestion,
  SurveyMatrixQuestion,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyScaleQuestion,
} from '@/services/surveyTypes';
import {
  createEmptyChoiceQuestion,
  createEmptyMatrixQuestion,
  createEmptyScaleQuestion,
  createEmptyShortAnswerQuestion,
  generateSurveyId,
} from '@/services/surveyTypes';

interface SurveyQuestionsEditorProps {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
}

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  single: '單選',
  multiple: '多選',
  short_answer: '簡答',
  scale: '滿意度量表',
  matrix: '矩陣量表',
};

const SURVEY_QUESTION_TYPE_OPTIONS = (
  Object.entries(TYPE_LABELS) as [SurveyQuestionType, string][]
).map(([value, label]) => ({ value, label }));

function createQuestionByType(type: SurveyQuestionType): SurveyQuestion {
  switch (type) {
    case 'single':
      return createEmptyChoiceQuestion('single');
    case 'multiple':
      return createEmptyChoiceQuestion('multiple');
    case 'scale':
      return createEmptyScaleQuestion(5);
    case 'matrix':
      return createEmptyMatrixQuestion(5);
    default:
      return createEmptyShortAnswerQuestion();
  }
}

export default function SurveyQuestionsEditor({
  questions,
  onChange,
}: SurveyQuestionsEditorProps) {
  const updateQuestion = (index: number, next: SurveyQuestion) => {
    const list = [...questions];
    list[index] = next;
    onChange(list);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const addQuestion = (type: SurveyQuestionType = 'single') => {
    onChange([...questions, createQuestionByType(type)]);
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4 bg-white">
      {questions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm mb-4">尚未新增題目</p>
          <button
            type="button"
            onClick={() => addQuestion('single')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            新增新題目
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <QuestionEditor
              key={q.id}
              question={q}
              index={qi}
              onChange={(next) => updateQuestion(qi, next)}
              onRemove={() => removeQuestion(qi)}
            />
          ))}
          <div className="flex justify-end pt-2">
            <Dropdown
              value=""
              onChange={(type) => addQuestion(type as SurveyQuestionType)}
              options={[
                { value: '', label: '＋ 新增題目（選擇題型）' },
                ...SURVEY_QUESTION_TYPE_OPTIONS,
              ]}
              placeholder="新增題目"
              className="w-52"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  onChange: (q: SurveyQuestion) => void;
  onRemove: () => void;
}) {
  const handleTypeChange = (newType: SurveyQuestionType) => {
    if (newType === question.type) return;
    const fresh = createQuestionByType(newType);
    onChange({
      ...fresh,
      id: question.id,
      content: question.content,
      required: question.required,
    });
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bars3Icon className="w-4 h-4 text-gray-300 shrink-0" />
          <span className="text-xs font-bold text-indigo-600 shrink-0">Q{index + 1}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-500" title="刪除題目">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1.5 block">題型</label>
        <Dropdown
          value={question.type}
          onChange={(type) => handleTypeChange(type as SurveyQuestionType)}
          options={SURVEY_QUESTION_TYPE_OPTIONS}
          className="w-full sm:w-52"
        />
      </div>

      <textarea
        value={question.content}
        onChange={(e) => onChange({ ...question, content: e.target.value })}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={2}
        placeholder={
          question.type === 'matrix'
            ? '矩陣題說明，例如：1（非常不同意）到 5（非常同意）'
            : '題目內容'
        }
      />

      <label className="inline-flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={question.required !== false}
          onChange={(e) => onChange({ ...question, required: e.target.checked })}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        必填
      </label>

      {(question.type === 'single' || question.type === 'multiple') && (
        <ChoiceFields question={question} onChange={onChange} />
      )}
      {question.type === 'scale' && <ScaleFields question={question} onChange={onChange} />}
      {question.type === 'matrix' && <MatrixFields question={question} onChange={onChange} />}
    </div>
  );
}

function ChoiceFields({
  question,
  onChange,
}: {
  question: SurveyChoiceQuestion;
  onChange: (q: SurveyChoiceQuestion) => void;
}) {
  const updateOption = (i: number, value: string) => {
    const options = [...question.options];
    options[i] = value;
    onChange({ ...question, options });
  };

  return (
    <div className="space-y-2">
      {question.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
          <input
            type="text"
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={`選項 ${i + 1}`}
          />
          {question.options.length > 2 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...question,
                  options: question.options.filter((_, idx) => idx !== i),
                })
              }
              className="text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...question,
            options: [...question.options, `選項 ${question.options.length + 1}`],
          })
        }
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        + 新增選項
      </button>
      {question.type === 'multiple' && (
        <label className="flex items-center gap-2 text-sm text-gray-600 pt-1">
          <input
            type="checkbox"
            checked={!!question.allowOther}
            onChange={(e) => onChange({ ...question, allowOther: e.target.checked })}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          最後一格加入「其他」自由填寫
        </label>
      )}
    </div>
  );
}

function ScaleFields({
  question,
  onChange,
}: {
  question: SurveyScaleQuestion;
  onChange: (q: SurveyScaleQuestion) => void;
}) {
  const [maxDraft, setMaxDraft] = React.useState(String(question.maxScore));

  React.useEffect(() => {
    setMaxDraft(String(question.maxScore));
  }, [question.id, question.maxScore]);

  const commitMaxScore = () => {
    const parsed = Number.parseInt(maxDraft, 10);
    const next = Number.isFinite(parsed) ? Math.min(20, Math.max(2, parsed)) : 5;
    setMaxDraft(String(next));
    if (next !== question.maxScore) {
      onChange({ ...question, maxScore: next });
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label className="text-sm space-y-1">
        <span className="text-gray-500">滿分（2–20）</span>
        <input
          type="number"
          min={2}
          max={20}
          inputMode="numeric"
          value={maxDraft}
          onChange={(e) => setMaxDraft(e.target.value)}
          onBlur={commitMaxScore}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        />
      </label>
      <label className="text-sm space-y-1">
        <span className="text-gray-500">低分標籤</span>
        <input
          type="text"
          value={question.minLabel ?? ''}
          onChange={(e) => onChange({ ...question, minLabel: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          placeholder="低"
        />
      </label>
      <label className="text-sm space-y-1">
        <span className="text-gray-500">高分標籤</span>
        <input
          type="text"
          value={question.maxLabel ?? ''}
          onChange={(e) => onChange({ ...question, maxLabel: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          placeholder="高"
        />
      </label>
    </div>
  );
}

function MatrixFields({
  question,
  onChange,
}: {
  question: SurveyMatrixQuestion;
  onChange: (q: SurveyMatrixQuestion) => void;
}) {
  const [maxDraft, setMaxDraft] = React.useState(String(question.maxScore));

  React.useEffect(() => {
    setMaxDraft(String(question.maxScore));
  }, [question.id, question.maxScore]);

  const commitMaxScore = () => {
    const parsed = Number.parseInt(maxDraft, 10);
    const next = Number.isFinite(parsed) ? Math.min(20, Math.max(2, parsed)) : 5;
    setMaxDraft(String(next));
    if (next !== question.maxScore) {
      onChange({ ...question, maxScore: next });
    }
  };

  const filledLabels = question.rows.map((r) => r.label.trim()).filter(Boolean);
  const hasDuplicateLabels = filledLabels.length !== new Set(filledLabels).size;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-gray-500">量表滿分（2–20）</span>
          <input
            type="number"
            min={2}
            max={20}
            inputMode="numeric"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={commitMaxScore}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-gray-500">低分標籤</span>
          <input
            type="text"
            value={question.minLabel ?? ''}
            onChange={(e) => onChange({ ...question, minLabel: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-gray-500">高分標籤</span>
          <input
            type="text"
            value={question.maxLabel ?? ''}
            onChange={(e) => onChange({ ...question, maxLabel: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">列敘述（問題）</p>
        {hasDuplicateLabels && (
          <p className="text-xs text-amber-600">列敘述不可重複，請修改相同文字的項目。</p>
        )}
        {question.rows.map((row, i) => {
          const label = row.label.trim();
          const isDup =
            !!label &&
            question.rows.some((other, j) => j !== i && other.label.trim() === label);
          return (
            <div key={row.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) => {
                  const rows = [...question.rows];
                  rows[i] = { ...row, label: e.target.value };
                  onChange({ ...question, rows });
                }}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm bg-white ${
                  isDup ? 'border-amber-400 focus:ring-amber-300' : 'border-gray-200'
                }`}
                placeholder="例如：老師口條清晰，表達能力佳。"
              />
              {question.rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...question,
                      rows: question.rows.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...question,
              rows: [...question.rows, { id: generateSurveyId(), label: '' }],
            })
          }
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          + 新增列
        </button>
      </div>
    </div>
  );
}
