'use client';

import React from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { TrashIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import RichTextField from './RichTextField';
import SectionTitleInput from './SectionTitleInput';
import QuestionEditor from './QuestionEditor';
import Dropdown from '../ui/Dropdown';
import {
  type QuizSection,
  type Question,
  type QuestionType,
  type OptionLabelStyle,
  QUESTION_TYPE_OPTIONS,
  createEmptyQuestion,
  calculateSectionPoints,
  countSectionQuestions,
  getQuestionNumberMap,
  countQuizQuestions,
  relabelFillInCells,
  isFillInQuestion,
  isGroupQuestion,
  normalizeDefaultPoints,
  applySectionDefaultPoints,
} from '@/services/quizTypes';

interface SectionEditorProps {
  section: QuizSection;
  sectionIndex: number;
  allSections: QuizSection[];
  optionLabelStyle?: OptionLabelStyle;
  continuousQuestionNumbers?: boolean;
  onChange: (section: QuizSection) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function SectionEditor({
  section,
  sectionIndex,
  allSections,
  optionLabelStyle = 'letter_paren',
  continuousQuestionNumbers = true,
  onChange,
  onDelete,
  canDelete,
}: SectionEditorProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = React.useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = React.useState<string | null>(null);

  const questionNumberMap = React.useMemo(
    () => getQuestionNumberMap(allSections, continuousQuestionNumbers),
    [allSections, continuousQuestionNumbers]
  );
  const totalInQuiz = React.useMemo(() => countQuizQuestions({ sections: allSections }), [allSections]);
  const subQuestionNumbersByQuestionId = React.useMemo(() => {
    const result = new Map<string, Map<string, number>>();
    for (const q of section.questions) {
      if (!isGroupQuestion(q)) continue;
      const map = new Map<string, number>();
      for (const sub of q.subQuestions) {
        const num = questionNumberMap.get(sub.id);
        if (num) map.set(sub.id, num);
      }
      result.set(q.id, map);
    }
    return result;
  }, [section.questions, questionNumberMap]);
  const questionCount = countSectionQuestions(section);
  const sectionPoints = calculateSectionPoints(section);
  const defaultPoints = normalizeDefaultPoints(section.defaultPoints, 1);

  const addQuestion = (type: QuestionType = 'single') => {
    const nextNum = continuousQuestionNumbers ? totalInQuiz + 1 : questionCount + 1;
    const created = createEmptyQuestion(type, nextNum, optionLabelStyle, defaultPoints);
    onChange({
      ...section,
      questions: [...section.questions, created],
    });
    setExpandedQuestionId(created.id);
  };

  const setDefaultPoints = (raw: string) => {
    const digits = raw.replace(/[^\d.]/g, '');
    if (digits === '') {
      onChange({ ...section, defaultPoints: 0 });
      return;
    }
    const n = Number(digits);
    if (!Number.isNaN(n)) {
      onChange({ ...section, defaultPoints: normalizeDefaultPoints(n, 0) });
    }
  };

  const updateQuestion = (qIndex: number, updated: Question) => {
    const questions = [...section.questions];
    const num = questionNumberMap.get(updated.id);
    if (num && isFillInQuestion(updated)) {
      questions[qIndex] = relabelFillInCells(updated, num);
    } else {
      questions[qIndex] = updated;
    }
    onChange({ ...section, questions });
  };

  const deleteQuestion = (qIndex: number) => {
    const removedId = section.questions[qIndex]?.id;
    const questions = section.questions.filter((_, i) => i !== qIndex);
    onChange({ ...section, questions });
    if (removedId === expandedQuestionId) {
      setExpandedQuestionId(null);
    }
  };

  const onDragEnd = (result: DropResult) => {
    setDraggingQuestionId(null);
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const questions = [...section.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    onChange({ ...section, questions });
  };

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5/40 to-white shadow-sm">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-primary/20 bg-white/80">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg">
          {sectionIndex + 1}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitleInput
              value={section.title}
              onChange={(title) => onChange({ ...section, title })}
              placeholder="大題名稱，例如：選擇題"
              className="flex-1 min-w-[12rem] text-lg font-bold text-gray-800 bg-transparent border-b-2 border-transparent focus:border-primary/50 focus:outline-none px-0 py-1"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              {section.shuffleQuestions && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                  題目打亂
                </span>
              )}
              {section.shuffleOptions && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                  選項打亂
                </span>
              )}
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {questionCount} 題
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                預設 {defaultPoints} 分
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                共 {sectionPoints} 分
              </span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-primary/10"
              >
                {expanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                  title="刪除此大題"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          {expanded && (
            <div
              className="mt-3 space-y-3"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RichTextField
                label="大題說明"
                value={section.description ?? ''}
                onChange={(description) => onChange({ ...section, description })}
                placeholder="選填：此大題的作答說明或注意事項"
                minHeight="80px"
                compact
              />
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-amber-900">預設每題分數</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-gray-600">新增題目時帶入</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(defaultPoints)}
                      onChange={(e) => setDefaultPoints(e.target.value)}
                      onBlur={() =>
                        onChange({
                          ...section,
                          defaultPoints: normalizeDefaultPoints(section.defaultPoints, 1),
                        })
                      }
                      className="w-20 px-3 py-1.5 border border-amber-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <span>分</span>
                  </label>
                  {section.questions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange(applySectionDefaultPoints(section))}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 bg-white hover:bg-amber-100 transition-colors"
                    >
                      套用至本大題現有題目
                    </button>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-gray-700">作答時打亂設定</p>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!section.shuffleQuestions}
                    onChange={(e) => onChange({ ...section, shuffleQuestions: e.target.checked })}
                    className="w-4 h-4 text-primary accent-[#2D6DF6]"
                  />
                  打亂此大題的題目順序
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!section.shuffleOptions}
                    onChange={(e) => onChange({ ...section, shuffleOptions: e.target.checked })}
                    className="w-4 h-4 text-primary accent-[#2D6DF6]"
                  />
                  打亂單選／多選題的選項順序
                </label>
                <p className="text-xs text-slate-500">
                  題組以整組為單位參與大題排序；題組內子題順序請在各題組自行設定。選項打亂不含題組子題。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-4">
          {section.questions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-sm mb-4">此大題尚無題目</p>
              <button
                type="button"
                onClick={() => addQuestion('single')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-primary/50 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                新增新題目
              </button>
            </div>
          ) : (
            <DragDropContext
              onDragStart={(start) => setDraggingQuestionId(start.draggableId)}
              onDragEnd={onDragEnd}
            >
              <Droppable droppableId={`section-${section.id}`}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                    {section.questions.map((q, qIndex) => {
                      const qNum = isGroupQuestion(q)
                        ? questionNumberMap.get(q.subQuestions[0]?.id) ?? qIndex + 1
                        : questionNumberMap.get(q.id) ?? qIndex + 1;

                      return (
                        <Draggable key={q.id} draggableId={q.id} index={qIndex}>
                          {(dragProvided) => (
                            <QuestionEditor
                              question={q}
                              index={qIndex}
                              questionNumber={qNum}
                              totalInQuiz={totalInQuiz}
                              optionLabelStyle={optionLabelStyle}
                              defaultPoints={defaultPoints}
                              subQuestionNumbers={subQuestionNumbersByQuestionId.get(q.id)}
                              onChange={(updated) => updateQuestion(qIndex, updated)}
                              onDelete={() => deleteQuestion(qIndex)}
                              innerRef={dragProvided.innerRef}
                              draggableProps={dragProvided.draggableProps}
                              dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                              isDragging={draggingQuestionId === q.id}
                              expanded={expandedQuestionId === q.id}
                              onExpandedChange={(isOpen) => setExpandedQuestionId(isOpen ? q.id : null)}
                            />
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {section.questions.length > 0 && (
            <div className="flex justify-end pt-2">
              <Dropdown
                value=""
                onChange={(type) => addQuestion(type as QuestionType)}
                options={[{ value: '', label: '＋ 新增題目（選擇題型）' }, ...QUESTION_TYPE_OPTIONS]}
                placeholder="新增題目"
                className="w-48"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(SectionEditor);
