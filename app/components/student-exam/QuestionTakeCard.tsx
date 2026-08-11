'use client';

import React from 'react';
import RichHtmlContent from '@/components/RichHtmlContent';
import FillInQuestionContent from '@/components/quiz/FillInQuestionContent';
import { isHtmlEmpty, toEditorHtml } from '@/utils/richText';
import { isChoiceOptionEqual } from '@/utils/quizChoiceMatch';
import {
  type Question,
  type SubQuestion,
  type OptionLabelStyle,
  type GridCellAnswer,
  QUESTION_TYPE_LABELS,
  GRID_CELL_ANSWERS,
  GRID_CELL_ANSWER_LABELS,
  buildGridCellLabel,
  formatOptionLabel,
  isChoiceQuestion,
  isTrueFalseQuestion,
  isFillInQuestion,
  isGroupQuestion,
  isShortAnswerQuestion,
} from '@/services/quizTypes';
import type { StudentAnswers, QuestionAnswerRecord } from '@/services/quizSubmissionTypes';
import {
  readFillInCellAnswer,
  shortAnswerCorrectnessLabel,
  writeFillInCellAnswer,
} from '@/services/quizSubmissionTypes';

function resolveTrueFalseCorrectAnswer(
  question: Extract<Question | SubQuestion, { type: 'tf' }>,
  record?: QuestionAnswerRecord
): boolean {
  if (
    record &&
    record.gradingStatus !== 'pending' &&
    typeof record.response === 'boolean'
  ) {
    if (record.isCorrect === true) return record.response;
    if (record.isCorrect === false) return !record.response;
  }
  return question.correctAnswer;
}

interface QuestionTakeCardProps {
  question: Question;
  questionNumber: number;
  optionLabelStyle?: OptionLabelStyle;
  subQuestionNumbers?: Map<string, number>;
  answers: StudentAnswers;
  skippedIds?: string[];
  readOnly: boolean;
  showGrading?: boolean;
  showCorrectAnswers?: boolean;
  gradingByQuestionId?: Map<string, QuestionAnswerRecord>;
  onAnswer: (questionId: string, value: StudentAnswers[string]) => void;
  onToggleSkip?: (questionId: string) => void;
  /** 題組：僅顯示指定子題（手機一題一頁） */
  visibleSubQuestionId?: string;
  /** 手機版強制選項縱向排列 */
  forceVerticalLayout?: boolean;
}

function QuestionStemContent({
  question,
  questionNumber,
  centerText,
  className = '',
}: {
  question: Question | SubQuestion;
  questionNumber: number;
  centerText: boolean;
  className?: string;
}) {
  const textAlign = centerText ? 'center' : 'left';

  if (isHtmlEmpty(question.content)) {
    return <span className="text-on-surfaceVariant italic">（無題目敘述）</span>;
  }

  if (isFillInQuestion(question)) {
    return (
      <FillInQuestionContent
        html={question.content}
        questionNumber={questionNumber}
        textAlign={textAlign}
        className={className}
      />
    );
  }

  return <RichHtmlContent html={question.content} textAlign={textAlign} className={className} />;
}

function AnswerGradingFeedback({ record }: { record: QuestionAnswerRecord }) {
  if (record.gradingStatus === 'pending') {
    return (
      <div className="mt-3 pt-3 border-t border-outline-variant/40">
        <p className="text-sm text-amber-700 font-medium">待老師批改</p>
      </div>
    );
  }

  const isShortAnswer = record.questionType === 'short_answer';
  let label: string;
  let tone: string;

  if (isShortAnswer) {
    const verdict = shortAnswerCorrectnessLabel(record.score, record.maxScore);
    label = verdict === 'correct' ? '答對' : record.score > 0 ? '部分正確' : '答錯';
    tone = verdict === 'correct' ? 'text-emerald-700' : 'text-red-700';
  } else if (record.isCorrect === true) {
    label = '答對';
    tone = 'text-emerald-700';
  } else if (record.isCorrect === false) {
    label = '答錯';
    tone = 'text-red-700';
  } else {
    label = '已批改';
    tone = 'text-on-surface';
  }

  return (
    <div className="mt-3 pt-3 border-t border-outline-variant/40 space-y-1">
      <p className={`text-sm font-medium ${tone}`}>
        {label} · {record.score} / {record.maxScore} 分
      </p>
      {record.teacherComment && (
        <div className="text-sm text-on-surfaceVariant">
          老師評語：
          <RichHtmlContent html={toEditorHtml(record.teacherComment)} />
        </div>
      )}
    </div>
  );
}

function ShortAnswerDisplay({ value, mobile = false }: { value: string | undefined; mobile?: boolean }) {
  const textClass = mobile ? 'text-base' : 'text-sm';
  const html = toEditorHtml(value ?? '');
  if (isHtmlEmpty(html)) {
    return <p className={`${textClass} text-on-surfaceVariant italic`}>（未作答）</p>;
  }
  return (
    <div className={`rounded-xl border border-outline-variant/40 bg-surface/80 px-4 py-3 ${textClass} text-on-surface min-h-[6rem]`}>
      <RichHtmlContent html={html} className={mobile ? 'exam-mobile-stem' : ''} />
    </div>
  );
}

function findChoiceOptionIndex(
  question: Extract<Question | SubQuestion, { type: 'single' | 'multiple' }>,
  answerHtml: string
): number {
  return question.options.findIndex((opt) => isChoiceOptionEqual(opt, answerHtml));
}

function isOptionMarkedCorrect(
  question: Extract<Question | SubQuestion, { type: 'single' | 'multiple' }>,
  optionIndex: number
): boolean {
  const opt = question.options[optionIndex];
  if (!opt || isHtmlEmpty(opt)) return false;
  if (question.correctAnswers.some((answer) => isChoiceOptionEqual(opt, answer))) return true;
  return false;
}

function ChoiceOptionContent({
  optionIndex,
  labelStyle,
  html,
  forceVerticalLayout = false,
  labelClassName = 'font-semibold text-on-surface shrink-0',
  leading,
  contentClassName = 'choice-option-content',
}: {
  optionIndex: number;
  labelStyle: OptionLabelStyle;
  html: string;
  forceVerticalLayout?: boolean;
  labelClassName?: string;
  leading?: React.ReactNode;
  contentClassName?: string;
}) {
  const textSize = forceVerticalLayout ? 'text-base' : 'text-sm';

  return (
    <div className={`flex items-center gap-2 min-w-0 w-full ${textSize}`}>
      {leading}
      <span className={labelClassName}>{formatOptionLabel(optionIndex, labelStyle)}</span>
      <div className="min-w-0 flex-1 overflow-visible text-on-surface w-full">
        <RichHtmlContent html={html} className={contentClassName} />
      </div>
    </div>
  );
}

function CorrectAnswerReveal({
  question,
  questionNumber,
  labelStyle,
  gradingRecord,
}: {
  question: Question | SubQuestion;
  questionNumber: number;
  labelStyle: OptionLabelStyle;
  gradingRecord?: QuestionAnswerRecord;
}) {
  return (
    <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-on-surfaceVariant">正確答案</p>

      {isChoiceQuestion(question) && (
        <div className="space-y-2 w-full">
          {question.correctAnswers.filter((a) => !isHtmlEmpty(a)).length === 0 ? (
            <p className="text-sm text-on-surfaceVariant italic">（尚未設定正確答案）</p>
          ) : (
            question.correctAnswers
              .filter((a) => !isHtmlEmpty(a))
              .map((answerHtml, i) => {
                const optionIndex = findChoiceOptionIndex(question, answerHtml);
                if (optionIndex >= 0) {
                  return (
                    <ChoiceOptionContent
                      key={`${i}-${optionIndex}`}
                      optionIndex={optionIndex}
                      labelStyle={labelStyle}
                      html={question.options[optionIndex]}
                      labelClassName="font-semibold text-on-surface shrink-0"
                      contentClassName="choice-option-content correct-answer-content"
                    />
                  );
                }
                return (
                  <div key={i} className="text-sm text-on-surface w-full">
                    <RichHtmlContent
                      html={answerHtml}
                      className="choice-option-content correct-answer-content"
                    />
                  </div>
                );
              })
          )}
        </div>
      )}

      {isTrueFalseQuestion(question) && (
        <p className="text-sm text-on-surface font-medium">
          {resolveTrueFalseCorrectAnswer(question, gradingRecord) ? '是' : '否'}
        </p>
      )}

      {isFillInQuestion(question) && (
        <div className="space-y-2">
          {question.cells.map((cell, i) => (
            <p key={cell.id} className="text-sm text-on-surface">
              <span className="font-semibold">{buildGridCellLabel(questionNumber, i)}</span>
              {' · '}
              {GRID_CELL_ANSWER_LABELS[cell.correctAnswer]}
            </p>
          ))}
        </div>
      )}

      {isShortAnswerQuestion(question) && question.referenceAnswer?.trim() && (
        <div className="text-sm text-on-surface">
          <RichHtmlContent html={toEditorHtml(question.referenceAnswer)} />
        </div>
      )}
    </div>
  );
}

function ChoiceTake({
  question,
  labelStyle,
  value,
  readOnly,
  showCorrectAnswers = false,
  forceVerticalLayout = false,
  onChange,
}: {
  question: Extract<Question | SubQuestion, { type: 'single' | 'multiple' }>;
  labelStyle: OptionLabelStyle;
  value: string | string[] | undefined;
  readOnly: boolean;
  showCorrectAnswers?: boolean;
  forceVerticalLayout?: boolean;
  onChange: (v: string | string[]) => void;
}) {
  const layout = forceVerticalLayout ? 'vertical' : (question.optionLayout ?? 'vertical');
  const containerClass =
    layout === 'horizontal' ? 'flex flex-wrap gap-x-8 gap-y-4' : 'flex flex-col gap-3';

  const selectedArr = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (opt: string) => {
    if (readOnly) return;
    if (question.type === 'single') {
      onChange(opt);
      return;
    }
    const exists = selectedArr.some((s) => isChoiceOptionEqual(s, opt));
    if (exists) {
      onChange(selectedArr.filter((s) => !isChoiceOptionEqual(s, opt)));
    } else {
      onChange([...selectedArr, opt]);
    }
  };

  return (
    <div className={containerClass}>
      {question.options.map((opt, i) => {
        if (isHtmlEmpty(opt)) return null;
        const checked = selectedArr.some((s) => isChoiceOptionEqual(s, opt));
        const isCorrectOption = isOptionMarkedCorrect(question, i);
        // 答錯時：以紅色標在正確選項上（不對正確答案文字上綠色）
        const markCorrectInRed = showCorrectAnswers && isCorrectOption && !checked;
        const inputType = question.type === 'single' ? 'radio' : 'checkbox';
        return (
          <label
            key={`${question.id}-opt-${i}-${opt.slice(0, 48)}`}
            className={`block cursor-pointer rounded-lg px-3 py-2.5 border transition-colors max-w-full ${
              forceVerticalLayout ? 'text-base' : 'text-sm'
            } ${
              markCorrectInRed
                ? 'border-red-300 bg-red-50'
                : checked
                  ? 'border-primary/50 bg-primary/20'
                  : 'border-transparent hover:bg-surface hover:border-outline-variant/40'
            } ${readOnly ? 'cursor-default' : ''}`}
          >
            <ChoiceOptionContent
              optionIndex={i}
              labelStyle={labelStyle}
              html={opt}
              forceVerticalLayout={forceVerticalLayout}
              leading={
                <input
                  type={inputType}
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => toggle(opt)}
                  className="size-4 accent-[#2D6DF6] shrink-0"
                />
              }
            />
          </label>
        );
      })}
    </div>
  );
}

function FillInTake({
  question,
  questionNumber,
  value,
  readOnly,
  showCorrectAnswers = false,
  onChange,
}: {
  question: Extract<Question | SubQuestion, { type: 'fill_in' }>;
  questionNumber: number;
  value: Record<string, GridCellAnswer> | undefined;
  readOnly: boolean;
  showCorrectAnswers?: boolean;
  onChange: (v: Record<string, GridCellAnswer>) => void;
}) {
  const current = value ?? {};

  const pick = (cell: (typeof question.cells)[number], cellIndex: number, ans: GridCellAnswer) => {
    if (readOnly) return;
    onChange(writeFillInCellAnswer(current, cell, cellIndex, ans));
  };

  return (
    <div className="space-y-4">
      {question.cells.map((cell, i) => (
        <div
          key={cell.id}
          className="flex flex-wrap items-center gap-x-8 gap-y-3 bg-surface/80 rounded-xl border border-outline-variant/40 px-4 py-3"
        >
          <span className="text-sm font-semibold text-on-surface shrink-0 min-w-[3rem]">
            {buildGridCellLabel(questionNumber, i)}
          </span>
          <div className="flex flex-wrap items-end gap-5">
            {GRID_CELL_ANSWERS.map((ans) => {
              const selected = readFillInCellAnswer(current, cell, i) === ans;
              const cellWrong =
                showCorrectAnswers && readFillInCellAnswer(current, cell, i) !== cell.correctAnswer;
              const markCorrectInRed = cellWrong && ans === cell.correctAnswer;
              return (
              <label
                key={ans}
                className={`flex flex-col items-center gap-1.5 cursor-pointer min-w-[2rem] rounded-md px-1.5 py-1 ${
                  markCorrectInRed ? 'bg-red-50 ring-1 ring-red-300' : ''
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                <span className="text-sm font-mono text-on-surface">
                  {GRID_CELL_ANSWER_LABELS[ans]}
                </span>
                <input
                  type="radio"
                  name={`take-${cell.id}`}
                  checked={selected}
                  disabled={readOnly}
                  onChange={() => pick(cell, i, ans)}
                  className="w-4 h-4 accent-[#2D6DF6]"
                />
              </label>
            );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupStemCard({
  question,
  forceVerticalLayout,
}: {
  question: Extract<Question, { type: 'group' }>;
  forceVerticalLayout: boolean;
}) {
  const padding = forceVerticalLayout ? 'p-4' : 'p-5 sm:p-6';
  const textClass = forceVerticalLayout ? 'text-base leading-relaxed' : 'text-sm sm:text-base';

  return (
    <article className={`bg-white rounded-2xl border border-outline-variant/40 shadow-sm ${padding}`}>
      <p className={`text-primary font-semibold mb-3 ${forceVerticalLayout ? 'text-sm' : 'text-xs'}`}>
        題組題幹
      </p>
      <div className={`text-on-surface ${textClass}`}>
        {isHtmlEmpty(question.content) ? (
          <span className="text-on-surfaceVariant italic">（無題目敘述）</span>
        ) : (
          <QuestionStemContent
            question={question}
            questionNumber={0}
            centerText={false}
            className={forceVerticalLayout ? 'exam-mobile-stem' : ''}
          />
        )}
      </div>
    </article>
  );
}

function SkipButton({
  questionId,
  skipped,
  readOnly,
  onToggleSkip,
}: {
  questionId: string;
  skipped: boolean;
  readOnly: boolean;
  onToggleSkip?: (id: string) => void;
}) {
  if (readOnly || !onToggleSkip) return null;
  return (
    <button
      type="button"
      onClick={() => onToggleSkip(questionId)}
      className={`text-xs font-medium shrink-0 px-2 py-1 rounded-md border transition-colors ${
        skipped
          ? 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100'
          : 'text-on-surfaceVariant border-outline-variant/40 hover:bg-surface hover:text-on-surface'
      }`}
    >
      {skipped ? '取消略過' : '標記略過'}
    </button>
  );
}

function SubQuestionTake({
  sub,
  subNumber,
  optionLabelStyle,
  answers,
  skippedIds,
  readOnly,
  showGrading = false,
  showCorrectAnswers = false,
  gradingByQuestionId,
  forceVerticalLayout = false,
  onAnswer,
  onToggleSkip,
}: {
  sub: SubQuestion;
  subNumber: number;
  optionLabelStyle: OptionLabelStyle;
  answers: StudentAnswers;
  skippedIds?: string[];
  readOnly: boolean;
  showGrading?: boolean;
  showCorrectAnswers?: boolean;
  gradingByQuestionId?: Map<string, QuestionAnswerRecord>;
  forceVerticalLayout?: boolean;
  onAnswer: (questionId: string, value: StudentAnswers[string]) => void;
  onToggleSkip?: (questionId: string) => void;
}) {
  const labelStyle = optionLabelStyle;
  const padding = forceVerticalLayout ? 'p-4' : 'p-5 sm:p-6';
  const textClass = forceVerticalLayout ? 'text-base leading-relaxed' : 'text-sm sm:text-base';

  return (
    <article
      id={`question-${sub.id}`}
      className={`bg-white rounded-2xl border border-outline-variant/40 shadow-sm scroll-mt-28 ${padding}`}
    >
      <div className="flex items-start gap-2 mb-4">
        <span className="text-on-surface font-bold shrink-0 text-base leading-[1.7]">{subNumber}.</span>
        <div className={`flex-1 min-w-0 text-on-surface leading-[1.7] ${textClass}`}>
          {!isHtmlEmpty(sub.content) ? (
            <QuestionStemContent
              question={sub}
              questionNumber={subNumber}
              centerText={false}
              className={forceVerticalLayout ? 'exam-mobile-stem' : ''}
            />
          ) : (
            <span className="text-on-surfaceVariant italic">（無題目敘述）</span>
          )}
        </div>
        <SkipButton
          questionId={sub.id}
          skipped={!!skippedIds?.includes(sub.id)}
          readOnly={readOnly}
          onToggleSkip={onToggleSkip}
        />
      </div>
      <p className={`text-on-surfaceVariant mb-4 ${forceVerticalLayout ? 'text-sm' : 'text-xs'}`}>
        {QUESTION_TYPE_LABELS[sub.type]}
        <span className="ml-2 text-amber-700 font-medium">· {sub.points} 分</span>
      </p>
      {isChoiceQuestion(sub) && (
        <ChoiceTake
          question={sub}
          labelStyle={labelStyle}
          value={answers[sub.id] as string | string[] | undefined}
          readOnly={readOnly}
          showCorrectAnswers={showCorrectAnswers}
          forceVerticalLayout={forceVerticalLayout}
          onChange={(v) => onAnswer(sub.id, v)}
        />
      )}
      {isTrueFalseQuestion(sub) && (
        <div className="flex gap-6 text-sm">
          {[
            { value: true, label: '是' },
            { value: false, label: '否' },
          ].map((opt) => {
            const tfCorrect = resolveTrueFalseCorrectAnswer(sub, gradingByQuestionId?.get(sub.id));
            const selected = answers[sub.id] === opt.value;
            const markCorrectInRed =
              showCorrectAnswers && answers[sub.id] !== tfCorrect && opt.value === tfCorrect;
            return (
            <label
              key={String(opt.value)}
              className={`flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 ${
                markCorrectInRed ? 'bg-red-50 ring-1 ring-red-300' : ''
              }`}
            >
              <input
                type="radio"
                checked={selected}
                disabled={readOnly}
                onChange={() => onAnswer(sub.id, opt.value)}
                className="accent-[#2D6DF6]"
              />
              <span>{opt.label}</span>
            </label>
          );
          })}
        </div>
      )}
      {isFillInQuestion(sub) && (
        <FillInTake
          question={sub}
          questionNumber={subNumber}
          value={answers[sub.id] as Record<string, GridCellAnswer> | undefined}
          readOnly={readOnly}
          showCorrectAnswers={showCorrectAnswers}
          onChange={(v) => onAnswer(sub.id, v)}
        />
      )}
      {isShortAnswerQuestion(sub) &&
        (readOnly ? (
          <ShortAnswerDisplay value={answers[sub.id] as string | undefined} mobile={forceVerticalLayout} />
        ) : (
          <textarea
            rows={4}
            value={(answers[sub.id] as string) ?? ''}
            onChange={(e) => onAnswer(sub.id, e.target.value)}
            placeholder="請在此輸入答案..."
            className={`w-full px-4 py-3 border border-outline-variant/50 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[6rem] ${
              forceVerticalLayout ? 'text-base' : 'text-sm'
            }`}
          />
        ))}
      {showCorrectAnswers && (
        <div className="overflow-visible">
          <CorrectAnswerReveal
            question={sub}
            questionNumber={subNumber}
            labelStyle={labelStyle}
            gradingRecord={gradingByQuestionId?.get(sub.id)}
          />
        </div>
      )}
      {showGrading && gradingByQuestionId?.get(sub.id) && (
        <AnswerGradingFeedback record={gradingByQuestionId.get(sub.id)!} />
      )}
    </article>
  );
}

export default function QuestionTakeCard({
  question,
  questionNumber,
  optionLabelStyle = 'letter_paren',
  subQuestionNumbers,
  answers,
  skippedIds,
  readOnly,
  showGrading = false,
  showCorrectAnswers = false,
  gradingByQuestionId,
  onAnswer,
  onToggleSkip,
  visibleSubQuestionId,
  forceVerticalLayout = false,
}: QuestionTakeCardProps) {
  const visibleSubQuestions =
    isGroupQuestion(question) && visibleSubQuestionId
      ? question.subQuestions.filter((sub) => sub.id === visibleSubQuestionId)
      : isGroupQuestion(question)
        ? question.subQuestions
        : [];

  if (isGroupQuestion(question)) {
    return (
      <div id={`question-${question.id}`} className="space-y-4 scroll-mt-28">
        <GroupStemCard question={question} forceVerticalLayout={forceVerticalLayout} />
        <div className="space-y-4">
          {visibleSubQuestions.map((sub) => (
            <SubQuestionTake
              key={sub.id}
              sub={sub}
              subNumber={subQuestionNumbers?.get(sub.id) ?? 0}
              optionLabelStyle={optionLabelStyle}
              answers={answers}
              skippedIds={skippedIds}
              readOnly={readOnly}
              showGrading={showGrading}
              showCorrectAnswers={showCorrectAnswers}
              gradingByQuestionId={gradingByQuestionId}
              forceVerticalLayout={forceVerticalLayout}
              onAnswer={onAnswer}
              onToggleSkip={onToggleSkip}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <article
      id={`question-${question.id}`}
      className={`bg-white rounded-2xl border border-outline-variant/40 shadow-sm scroll-mt-28 ${
        forceVerticalLayout ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      {forceVerticalLayout ? (
        <div className="flex items-start gap-2 mb-4">
          <span className="text-on-surface font-bold shrink-0 text-base leading-[1.75]">{questionNumber}.</span>
          <div className="flex-1 min-w-0 text-on-surface text-base leading-[1.75]">
            <QuestionStemContent
              question={question}
              questionNumber={questionNumber}
              centerText={false}
              className="exam-mobile-stem"
            />
          </div>
          <SkipButton
            questionId={question.id}
            skipped={!!skippedIds?.includes(question.id)}
            readOnly={readOnly}
            onToggleSkip={onToggleSkip}
          />
        </div>
      ) : (
        <div className="flex items-start gap-2 mb-4">
          <span className="text-on-surface font-bold shrink-0 text-base leading-[1.7]">{questionNumber}.</span>
          <div className="flex-1 min-w-0 text-on-surface text-sm sm:text-base leading-[1.7]">
            <QuestionStemContent
              question={question}
              questionNumber={questionNumber}
              centerText={false}
            />
          </div>
          <SkipButton
            questionId={question.id}
            skipped={!!skippedIds?.includes(question.id)}
            readOnly={readOnly}
            onToggleSkip={onToggleSkip}
          />
        </div>
      )}

      <p className={`text-on-surfaceVariant mb-4 ${forceVerticalLayout ? 'text-sm' : 'text-xs'}`}>
        {QUESTION_TYPE_LABELS[question.type]}
        <span className="ml-2 text-amber-700 font-medium">· {question.points} 分</span>
      </p>

      {isChoiceQuestion(question) && (
        <ChoiceTake
          question={question}
          labelStyle={optionLabelStyle}
          value={answers[question.id] as string | string[] | undefined}
          readOnly={readOnly}
          showCorrectAnswers={showCorrectAnswers}
          forceVerticalLayout={forceVerticalLayout}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {isTrueFalseQuestion(question) && (
        <div className="flex gap-8 text-sm">
          {[
            { value: true, label: '是' },
            { value: false, label: '否' },
          ].map((opt) => {
            const tfCorrect = resolveTrueFalseCorrectAnswer(
              question,
              gradingByQuestionId?.get(question.id)
            );
            const selected = answers[question.id] === opt.value;
            const markCorrectInRed =
              showCorrectAnswers && answers[question.id] !== tfCorrect && opt.value === tfCorrect;
            return (
            <label
              key={String(opt.value)}
              className={`flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 ${
                markCorrectInRed ? 'bg-red-50 ring-1 ring-red-300' : ''
              }`}
            >
              <input
                type="radio"
                checked={selected}
                disabled={readOnly}
                onChange={() => onAnswer(question.id, opt.value)}
                className="accent-[#2D6DF6]"
              />
              <span>{opt.label}</span>
            </label>
          );
          })}
        </div>
      )}

      {isFillInQuestion(question) && (
        <FillInTake
          question={question}
          questionNumber={questionNumber}
          value={answers[question.id] as Record<string, GridCellAnswer> | undefined}
          readOnly={readOnly}
          showCorrectAnswers={showCorrectAnswers}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {isShortAnswerQuestion(question) &&
        (readOnly ? (
          <ShortAnswerDisplay value={answers[question.id] as string | undefined} mobile={forceVerticalLayout} />
        ) : (
          <textarea
            rows={5}
            value={(answers[question.id] as string) ?? ''}
            onChange={(e) => onAnswer(question.id, e.target.value)}
            placeholder="請在此輸入答案..."
            className={`w-full px-4 py-3 border border-outline-variant/50 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[8rem] ${
              forceVerticalLayout ? 'text-base' : 'text-sm'
            }`}
          />
        ))}

      {showCorrectAnswers && (
        <div className="overflow-visible">
          <CorrectAnswerReveal
            question={question}
            questionNumber={questionNumber}
            labelStyle={optionLabelStyle}
            gradingRecord={gradingByQuestionId?.get(question.id)}
          />
        </div>
      )}

      {showGrading && gradingByQuestionId?.get(question.id) && (
        <AnswerGradingFeedback record={gradingByQuestionId.get(question.id)!} />
      )}
    </article>
  );
}
