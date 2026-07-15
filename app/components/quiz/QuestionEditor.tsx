'use client';

import React from 'react';
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import Dropdown from '../ui/Dropdown';
import RichTextField from './RichTextField';
import RichTextEditor, { type RichTextEditorHandle } from '@/components/RichTextEditor';
import RichHtmlContent from '@/components/RichHtmlContent';
import FillInQuestionContent from './FillInQuestionContent';
import { isHtmlEmpty, toEditorHtml } from '@/utils/richText';
import { fixDraggableStyle } from '@/utils/dndStyle';
import {
  type Question,
  type SubQuestion,
  type QuestionType,
  type GridCell,
  type OptionLabelStyle,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
  SUB_QUESTION_TYPE_OPTIONS,
  OPTION_LAYOUT_OPTIONS,
  GRID_CELL_ANSWERS,
  GRID_CELL_ANSWER_LABELS,
  formatOptionLabel,
  createEmptyQuestion,
  createEmptySubQuestion,
  createEmptyGridCell,
  relabelFillInCells,
  isChoiceQuestion,
  isFillInQuestion,
  isGroupQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
} from '@/services/quizTypes';
import QuestionPreviewPanel from './QuestionPreviewPanel';
import { makeFillInBlankToken, removeFillInBlankTokenByCellIndex } from '@/utils/fillInContent';
import { useQuizImageContext } from './QuizImageContext';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow text-sm';
const labelClass = 'text-gray-700 text-sm font-bold mb-2 block';

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className={labelClass}>
      <span className="text-red-500 mr-0.5">*</span>
      {children}
    </label>
  );
}

function PointsInput({
  value,
  onChange,
  className = inputClass,
}: {
  value: number;
  onChange: (points: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setDraft(raw);
        if (raw !== '') {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      onBlur={() => {
        const n = draft === '' ? 0 : parseInt(draft, 10);
        const safe = Number.isNaN(n) ? 0 : Math.max(0, n);
        onChange(safe);
        setDraft(String(safe));
      }}
      className={className}
    />
  );
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  questionNumber: number;
  totalInQuiz: number;
  optionLabelStyle?: OptionLabelStyle;
  /** 所屬大題的預設配分（新增子題時帶入） */
  defaultPoints?: number;
  subQuestionNumbers?: Map<string, number>;
  onChange: (question: Question) => void;
  onDelete: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
  draggableProps?: React.HTMLAttributes<HTMLDivElement> & {
    style?: React.CSSProperties;
  };
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
  isDragging?: boolean;
}

function ChoiceDisplaySettings({
  optionLayout,
  onLayoutChange,
}: {
  optionLayout?: 'horizontal' | 'vertical';
  onLayoutChange: (layout: 'horizontal' | 'vertical') => void;
}) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
      <label className={labelClass + ' mb-0'}>選項顯示方式</label>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">排列方式</label>
        <Dropdown
          value={optionLayout ?? 'vertical'}
          onChange={(v) => onLayoutChange(v as 'horizontal' | 'vertical')}
          options={OPTION_LAYOUT_OPTIONS}
        />
      </div>
    </div>
  );
}

function TrueFalseEditor({
  correctAnswer,
  onChange,
}: {
  correctAnswer: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <label className={labelClass}>正確答案</label>
      <div className="flex gap-4">
        {[
          { value: true, label: '是' },
          { value: false, label: '否' },
        ].map((opt) => (
          <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={correctAnswer === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-indigo-600"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ShortAnswerReferenceEditor({
  referenceAnswer,
  onChange,
}: {
  referenceAnswer?: string;
  onChange: (referenceAnswer: string) => void;
}) {
  const value = referenceAnswer ?? '';
  const [local, setLocal] = React.useState(value);
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setLocal(value);
    }
  }, [value]);

  const commit = React.useCallback(
    (next: string) => {
      setLocal(next);
      if (next !== value) onChange(next);
    },
    [onChange, value]
  );

  return (
    <div className="space-y-2">
      <label className={labelClass}>參考答案（選填）</label>
      <textarea
        rows={4}
        value={local}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit(local);
        }}
        onCompositionEnd={(e) => {
          const next = e.currentTarget.value;
          setLocal(next);
          if (next !== value) onChange(next);
        }}
        onChange={(e) => {
          setLocal(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="可輸入參考答案或評分要點，僅供批改時參考…"
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y min-h-[6rem]"
      />
      <p className="text-xs text-gray-400">
        簡答題一律由老師手動批改；系統不會比對此參考答案，學生也看不到。
      </p>
    </div>
  );
}

function FillInBlankInsertBar({
  cells,
  onInsert,
}: {
  cells: GridCell[];
  onInsert: (token: string) => void;
}) {
  if (cells.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className="text-xs text-gray-500 shrink-0">插入選填格至題目：</span>
      {cells.map((cell, i) => (
        <button
          key={cell.id}
          type="button"
          onClick={() => onInsert(makeFillInBlankToken(i + 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
        >
          {cell.label}
        </button>
      ))}
    </div>
  );
}

function GsatGridAnswerEditor({
  cells,
  questionNumber,
  onChange,
}: {
  cells: GridCell[];
  questionNumber: number;
  onChange: (cells: GridCell[], removedCellIndex?: number) => void;
}) {
  return (
    <div className="space-y-3">
      <RequiredLabel>答案設定（學測畫卡格式）</RequiredLabel>
      <p className="text-xs text-gray-400 -mt-2">
        題號在左、選項在右，每格限填一個符號（含 0）。一個編號對應一格答案；可在題目文字游標處，或於 LaTeX
        公式編輯視窗內插入選填格{' '}
        <code className="text-emerald-700">[[-N]]</code>。
      </p>
      {cells.map((cell, cellIdx) => (
        <div
          key={cell.id}
          className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3"
        >
          <span className="text-sm font-semibold text-gray-800 shrink-0 min-w-[3rem]">
            {cell.label}
          </span>
          <div className="flex flex-wrap items-end gap-4">
            {GRID_CELL_ANSWERS.map((ans) => (
              <label key={ans} className="flex flex-col items-center gap-1.5 cursor-pointer min-w-[1.75rem]">
                <span className="text-sm text-gray-700 font-mono leading-none">
                  {GRID_CELL_ANSWER_LABELS[ans]}
                </span>
                <input
                  type="radio"
                  name={`grid-${cell.id}`}
                  checked={cell.correctAnswer === ans}
                  onChange={() => {
                    const next = [...cells];
                    next[cellIdx] = { ...cell, correctAnswer: ans };
                    onChange(next);
                  }}
                  className="accent-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>
          {cells.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const filtered = cells.filter((_, idx) => idx !== cellIdx);
                onChange(
                  filtered.map((c, i) => ({
                    ...c,
                    label: createEmptyGridCell(i, questionNumber).label,
                  })),
                  cellIdx
                );
              }}
              className="ml-auto text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              移除此格
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...cells, createEmptyGridCell(cells.length, questionNumber)])}
        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
      >
        <PlusIcon className="w-4 h-4" /> 新增格子
      </button>
    </div>
  );
}

function ChoiceOptionsEditor({
  options,
  correctAnswers,
  multiple,
  labelStyle,
  onOptionsChange,
  onCorrectChange,
}: {
  options: string[];
  correctAnswers: string[];
  multiple: boolean;
  labelStyle: OptionLabelStyle;
  onOptionsChange: (options: string[]) => void;
  onCorrectChange: (answers: string[]) => void;
}) {
  /** RichTextEditor 有 memo，未改動的選項不會重渲染，onChange 會卡住舊 closure；改以 ref 讀最新資料 */
  const optionsRef = React.useRef(options);
  const correctAnswersRef = React.useRef(correctAnswers);
  const onOptionsChangeRef = React.useRef(onOptionsChange);
  const onCorrectChangeRef = React.useRef(onCorrectChange);
  optionsRef.current = options;
  correctAnswersRef.current = correctAnswers;
  onOptionsChangeRef.current = onOptionsChange;
  onCorrectChangeRef.current = onCorrectChange;

  const handleOptionHtmlChange = React.useCallback((index: number, html: string) => {
    const prev = optionsRef.current;
    const oldVal = prev[index] ?? '';
    const next = prev.map((item, idx) => (idx === index ? html : item));
    onOptionsChangeRef.current(next);
    const corrects = correctAnswersRef.current;
    if (corrects.includes(oldVal)) {
      onCorrectChangeRef.current(corrects.map((a) => (a === oldVal ? html : a)));
    }
  }, []);

  const toggleCorrect = (option: string) => {
    const corrects = correctAnswersRef.current;
    if (multiple) {
      const next = corrects.includes(option)
        ? corrects.filter((a) => a !== option)
        : [...corrects, option];
      onCorrectChangeRef.current(next);
    } else {
      onCorrectChangeRef.current(option ? [option] : []);
    }
  };

  const removeOption = (index: number) => {
    const prev = optionsRef.current;
    const removed = prev[index];
    onOptionsChangeRef.current(prev.filter((_, idx) => idx !== index));
    onCorrectChangeRef.current(correctAnswersRef.current.filter((a) => a !== removed));
  };

  return (
    <div className="space-y-3">
      <RequiredLabel>選項</RequiredLabel>
      {options.map((opt, i) => (
        <div key={`opt-row-${i}`} className="flex items-center gap-2">
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={multiple ? undefined : 'correct-answer'}
            checked={correctAnswers.includes(opt) && !isHtmlEmpty(opt)}
            onChange={() => toggleCorrect(opt)}
            className="w-4 h-4 text-indigo-600 accent-indigo-600 flex-shrink-0"
            disabled={isHtmlEmpty(opt)}
          />
          <span className="text-sm font-semibold text-gray-600 shrink-0 leading-none">
            {formatOptionLabel(i, labelStyle)}
          </span>
          <div className="flex-1 min-w-0">
            <RichTextEditor
              instanceKey={`opt-${i}`}
              value={toEditorHtml(opt)}
              onChange={(html) => handleOptionHtmlChange(i, html)}
              latexOnly
              minHeight="56px"
              placeholder={`選項 ${formatOptionLabel(i, labelStyle)}`}
            />
          </div>
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="w-8 h-8 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center flex-shrink-0"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onOptionsChangeRef.current([...optionsRef.current, ''])}
        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
      >
        <PlusIcon className="w-4 h-4" /> 新增選項
      </button>
    </div>
  );
}

function SubQuestionFields({
  subQuestion,
  subNumber,
  quizDefaultLabelStyle,
  onChange,
  onDelete,
}: {
  subQuestion: SubQuestion;
  subNumber: number;
  quizDefaultLabelStyle: OptionLabelStyle;
  onChange: (q: SubQuestion) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const subQuestionRef = React.useRef(subQuestion);
  const onChangeRef = React.useRef(onChange);
  const editorRef = React.useRef<RichTextEditorHandle>(null);
  subQuestionRef.current = subQuestion;
  onChangeRef.current = onChange;

  const patchSub = React.useCallback((patch: Partial<SubQuestion>) => {
    onChangeRef.current({ ...subQuestionRef.current, ...patch } as SubQuestion);
  }, []);

  const handleFillInChange = React.useCallback(
    (cells: GridCell[], removedCellIndex?: number) => {
      const current = subQuestionRef.current;
      if (!isFillInQuestion(current)) return;
      const content =
        removedCellIndex !== undefined
          ? removeFillInBlankTokenByCellIndex(current.content, removedCellIndex)
          : current.content;
      onChangeRef.current(
        relabelFillInCells({ ...current, cells, content }, subNumber)
      );
    },
    [subNumber]
  );

  const insertFillInToken = React.useCallback((token: string) => {
    if (editorRef.current) {
      editorRef.current.insertFillInToken(token);
      return;
    }
    const current = subQuestionRef.current;
    patchSub({ content: `${current.content}${token}` });
  }, [patchSub]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-base font-bold text-gray-900 shrink-0">{subNumber}.</span>
        <span className="text-xs text-gray-500">
          {QUESTION_TYPE_LABELS[subQuestion.type]} · {subQuestion.points} 分
        </span>
        <div className="flex-1" />
        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }} className="text-gray-400 p-1">
          {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-7 h-7 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
            <RichTextField
              ref={editorRef}
              label="子題內容"
              value={subQuestion.content}
              onChange={(content) => patchSub({ content })}
              placeholder="輸入子題目敘述"
              minHeight="100px"
              instanceKey={`sub-${subQuestion.id}`}
              fillInCellLabels={
                isFillInQuestion(subQuestion) ? subQuestion.cells.map((c) => c.label) : undefined
              }
              fillInQuestionNumber={isFillInQuestion(subQuestion) ? subNumber : undefined}
            />
            <div>
              <label className={labelClass}>配分</label>
              <PointsInput
                value={subQuestion.points}
                onChange={(points) => patchSub({ points })}
              />
            </div>
          </div>

          {isChoiceQuestion(subQuestion) && (
            <>
              <ChoiceDisplaySettings
                optionLayout={subQuestion.optionLayout}
                onLayoutChange={(optionLayout) => patchSub({ optionLayout })}
              />
              <ChoiceOptionsEditor
                options={subQuestion.options}
                correctAnswers={subQuestion.correctAnswers}
                multiple={subQuestion.type === 'multiple'}
                labelStyle={quizDefaultLabelStyle}
                onOptionsChange={(options) => patchSub({ options })}
                onCorrectChange={(correctAnswers) => patchSub({ correctAnswers })}
              />
            </>
          )}
          {isTrueFalseQuestion(subQuestion) && (
            <TrueFalseEditor
              correctAnswer={subQuestion.correctAnswer}
              onChange={(correctAnswer) => patchSub({ correctAnswer })}
            />
          )}
          {isFillInQuestion(subQuestion) && (
            <>
              <FillInBlankInsertBar cells={subQuestion.cells} onInsert={insertFillInToken} />
              <GsatGridAnswerEditor
                cells={subQuestion.cells}
                questionNumber={subNumber}
                onChange={handleFillInChange}
              />
            </>
          )}
          {isShortAnswerQuestion(subQuestion) && (
            <ShortAnswerReferenceEditor
              referenceAnswer={subQuestion.referenceAnswer}
              onChange={(referenceAnswer) => patchSub({ referenceAnswer })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestionEditor({
  question,
  index,
  questionNumber,
  totalInQuiz,
  optionLabelStyle = 'letter_paren',
  defaultPoints = 1,
  subQuestionNumbers,
  onChange,
  onDelete,
  innerRef,
  draggableProps,
  dragHandleProps,
  expanded: expandedProp,
  onExpandedChange,
  defaultExpanded = false,
  isDragging = false,
}: QuestionEditorProps) {
  const quizImageContext = useQuizImageContext();
  const questionRef = React.useRef(question);
  const onChangeRef = React.useRef(onChange);
  const contentEditorRef = React.useRef<RichTextEditorHandle>(null);
  questionRef.current = question;
  onChangeRef.current = onChange;

  const patchQuestion = React.useCallback((patch: Partial<Question>) => {
    onChangeRef.current({ ...questionRef.current, ...patch } as Question);
  }, []);

  const patchGroupSubQuestion = React.useCallback((subIdx: number, updated: SubQuestion) => {
    const current = questionRef.current;
    if (!isGroupQuestion(current)) return;
    const subQuestions = [...current.subQuestions];
    subQuestions[subIdx] = updated;
    onChangeRef.current({ ...current, subQuestions });
  }, []);

  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
  const expanded = isDragging ? false : (expandedProp ?? internalExpanded);
  const [previewQuestion, setPreviewQuestion] = React.useState(question);

  React.useEffect(() => {
    if (!expanded) return;
    const timer = window.setTimeout(() => setPreviewQuestion(question), 300);
    return () => window.clearTimeout(timer);
  }, [question, expanded]);

  React.useEffect(() => {
    if (expanded) setPreviewQuestion(question);
  }, [expanded, question.id]);

  const setExpanded = (value: boolean) => {
    if (expandedProp === undefined) setInternalExpanded(value);
    onExpandedChange?.(value);
  };

  const typeBadgeColor: Record<QuestionType, string> = {
    single: 'bg-indigo-100 text-indigo-700',
    multiple: 'bg-purple-100 text-purple-700',
    fill_in: 'bg-emerald-100 text-emerald-700',
    tf: 'bg-amber-100 text-amber-700',
    short_answer: 'bg-rose-100 text-rose-700',
    group: 'bg-gray-200 text-gray-700',
  };

  const previewText = isHtmlEmpty(question.content) ? '（尚未輸入題目）' : null;

  const addSubQuestion = (type: Exclude<QuestionType, 'group'>) => {
    const current = questionRef.current;
    if (!isGroupQuestion(current)) return;
    const nextNum = (subQuestionNumbers?.size ?? current.subQuestions.length) + questionNumber;
    onChangeRef.current({
      ...current,
      subQuestions: [
        ...current.subQuestions,
        createEmptySubQuestion(type, nextNum, optionLabelStyle, defaultPoints),
      ],
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    const current = questionRef.current;
    if (newType === current.type) return;
    const fresh = createEmptyQuestion(newType, questionNumber, optionLabelStyle);
    onChangeRef.current({
      ...fresh,
      id: current.id,
      content: current.content,
      points: current.points,
    });
  };

  const insertFillInToken = React.useCallback((token: string) => {
    if (contentEditorRef.current) {
      contentEditorRef.current.insertFillInToken(token);
      return;
    }
    const current = questionRef.current;
    patchQuestion({ content: `${current.content}${token}` });
  }, [patchQuestion]);

  const handleFillInChange = React.useCallback(
    (cells: GridCell[], removedCellIndex?: number) => {
      const current = questionRef.current;
      if (!isFillInQuestion(current)) return;
      const content =
        removedCellIndex !== undefined
          ? removeFillInBlankTokenByCellIndex(current.content, removedCellIndex)
          : current.content;
      onChangeRef.current(
        relabelFillInCells({ ...current, cells, content }, questionNumber)
      );
    },
    [questionNumber]
  );

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      style={fixDraggableStyle(draggableProps?.style)}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
        isDragging ? 'ring-2 ring-indigo-400 shadow-lg' : ''
      }`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
        onClick={() => !isDragging && setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isDragging) setExpanded(!expanded);
          }
        }}
      >
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1 touch-none"
          title="拖曳排序"
        >
          <Bars3Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-bold text-gray-500 w-10">
          {isGroupQuestion(question) ? '題組' : `${questionNumber}.`}
        </span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${typeBadgeColor[question.type]}`}>
          {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <div className="flex-1 min-w-0 text-sm text-gray-600 overflow-hidden">
          {previewText ? (
            <span className="text-gray-400">{previewText}</span>
          ) : isFillInQuestion(question) ? (
            <FillInQuestionContent
              html={question.content}
              questionNumber={questionNumber}
              lineClamp={1}
              className="text-sm text-gray-600 question-row-preview"
            />
          ) : (
            <RichHtmlContent
              html={question.content}
              lineClamp={1}
              className="text-sm text-gray-600 question-row-preview"
            />
          )}
        </div>
        {isGroupQuestion(question) && question.shuffleSubQuestions && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">
            子題打亂
          </span>
        )}
        {!isGroupQuestion(question) && (
          <span className="text-xs text-gray-400 flex-shrink-0">{question.points} 分</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-gray-400 hover:text-indigo-600 p-1"
        >
          {expanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-8 h-8 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors flex items-center justify-center"
          title="刪除題目"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 xl:grid-cols-2 min-h-[32rem]">
          <div className="p-5 space-y-5 border-b xl:border-b-0 xl:border-r border-gray-100 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">題型</label>
                <Dropdown
                  value={question.type}
                  onChange={(type) => handleTypeChange(type as QuestionType)}
                  options={QUESTION_TYPE_OPTIONS}
                />
              </div>
              {!isGroupQuestion(question) && (
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block">配分</label>
                  <PointsInput
                    value={question.points}
                    onChange={(points) => patchQuestion({ points })}
                  />
                </div>
              )}
            </div>

            <div className={isGroupQuestion(question) ? 'rounded-xl border border-indigo-100 bg-indigo-50/40 p-4' : ''}>
              <RequiredLabel>{isGroupQuestion(question) ? '題組題幹' : '題目'}</RequiredLabel>
              <RichTextEditor
                ref={contentEditorRef}
                instanceKey={`q-${question.id}`}
                value={toEditorHtml(question.content)}
                onChange={(content) => patchQuestion({ content })}
                placeholder="輸入題目敘述"
                minHeight="160px"
                enableFontSize={false}
                fillInCellLabels={
                  isFillInQuestion(question) ? question.cells.map((c) => c.label) : undefined
                }
                fillInQuestionNumber={isFillInQuestion(question) ? questionNumber : undefined}
              />
              {isFillInQuestion(question) && (
                <FillInBlankInsertBar cells={question.cells} onInsert={insertFillInToken} />
              )}
            </div>

            {isChoiceQuestion(question) && (
              <>
                <ChoiceDisplaySettings
                  optionLayout={question.optionLayout}
                  onLayoutChange={(optionLayout) => patchQuestion({ optionLayout })}
                />
                <ChoiceOptionsEditor
                  options={question.options}
                  correctAnswers={question.correctAnswers}
                  multiple={question.type === 'multiple'}
                  labelStyle={optionLabelStyle}
                  onOptionsChange={(options) => patchQuestion({ options })}
                  onCorrectChange={(correctAnswers) => patchQuestion({ correctAnswers })}
                />
              </>
            )}

            {isTrueFalseQuestion(question) && (
              <TrueFalseEditor
                correctAnswer={question.correctAnswer}
                onChange={(correctAnswer) => patchQuestion({ correctAnswer })}
              />
            )}

            {isFillInQuestion(question) && (
              <GsatGridAnswerEditor
                cells={question.cells}
                questionNumber={questionNumber}
                onChange={handleFillInChange}
              />
            )}

            {isShortAnswerQuestion(question) && (
              <ShortAnswerReferenceEditor
                referenceAnswer={question.referenceAnswer}
                onChange={(referenceAnswer) => patchQuestion({ referenceAnswer })}
              />
            )}

            {isGroupQuestion(question) && (
              <div className="space-y-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 space-y-2">
                  <p className="text-sm font-bold text-indigo-900">題組打亂設定</p>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!question.shuffleSubQuestions}
                      onChange={(e) => patchQuestion({ shuffleSubQuestions: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 accent-indigo-600"
                    />
                    打亂此題組的子題順序
                  </label>
                  <p className="text-xs text-indigo-700/70">
                    僅影響此題組內部子題順序。大題打亂時題組整組移動，不拆開子題。作答紀錄與批改為原稿順序。
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <label className={labelClass + ' mb-0'}>子題目</label>
                  <Dropdown
                    value=""
                    onChange={(type) => addSubQuestion(type as Exclude<QuestionType, 'group'>)}
                    options={[{ value: '', label: '＋ 新增子題' }, ...SUB_QUESTION_TYPE_OPTIONS]}
                    placeholder="新增子題"
                    className="w-36"
                  />
                </div>
                {question.subQuestions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
                    尚未新增子題
                  </div>
                ) : (
                  question.subQuestions.map((sub, subIdx) => (
                    <SubQuestionFields
                      key={sub.id}
                      subQuestion={sub}
                      subNumber={subQuestionNumbers?.get(sub.id) ?? subIdx + 1}
                      quizDefaultLabelStyle={optionLabelStyle}
                      onChange={(updated) => patchGroupSubQuestion(subIdx, updated)}
                      onDelete={() => {
                        const current = questionRef.current;
                        if (!isGroupQuestion(current)) return;
                        onChangeRef.current({
                          ...current,
                          subQuestions: current.subQuestions.filter((_, i) => i !== subIdx),
                        });
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="p-5 bg-slate-50/90 flex flex-col">
            <QuestionPreviewPanel
              question={previewQuestion}
              questionNumber={questionNumber}
              totalInQuiz={totalInQuiz}
              optionLabelStyle={optionLabelStyle}
              subQuestionNumbers={subQuestionNumbers}
            />
          </div>
        </div>
      )}
    </div>
  );
}
