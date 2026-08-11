'use client';

import React from 'react';
import RichHtmlContent from '@/components/RichHtmlContent';
import FillInQuestionContent from './FillInQuestionContent';
import { isHtmlEmpty } from '@/utils/richText';
import {
  type Question,
  type SubQuestion,
  type OptionLabelStyle,
  QUESTION_TYPE_LABELS,
  GRID_CELL_ANSWERS,
  GRID_CELL_ANSWER_LABELS,
  formatOptionLabel,
  isChoiceQuestion,
  isTrueFalseQuestion,
  isFillInQuestion,
  isGroupQuestion,
  isShortAnswerQuestion,
} from '@/services/quizTypes';

interface QuestionPreviewPanelProps {
  question: Question;
  questionNumber: number;
  totalInQuiz: number;
  optionLabelStyle?: OptionLabelStyle;
  subQuestionNumbers?: Map<string, number>;
}

const PREVIEW_CARD_CLASS = 'rounded-xl border-2 border-sky-300 bg-sky-50/90 p-5 shadow-sm';

function ChoiceOptionsPreview({
  question,
  labelStyle,
}: {
  question: Extract<Question | SubQuestion, { type: 'single' | 'multiple' }>;
  labelStyle: OptionLabelStyle;
}) {
  const layout = question.optionLayout ?? 'vertical';
  const containerClass =
    layout === 'horizontal' ? 'flex flex-wrap gap-x-6 gap-y-3' : 'flex flex-col gap-2';

  return (
    <div className={containerClass}>
      {question.options.map((opt, i) => {
        const isCorrect = question.correctAnswers.includes(opt) && !isHtmlEmpty(opt);
        return (
          <div
            key={i}
            className={`flex items-center gap-2 min-w-[6rem] max-w-full ${
              isCorrect ? 'ring-1 ring-emerald-400 rounded-lg px-2 py-1 bg-white/60' : ''
            }`}
          >
            <span className="font-semibold text-gray-700 shrink-0 leading-none">{formatOptionLabel(i, labelStyle)}</span>
            <div className="text-sm text-gray-700 min-w-0 leading-[1.5]">
              {isHtmlEmpty(opt) ? (
                <span className="text-gray-400 italic">暫無選項描述</span>
              ) : (
                <RichHtmlContent html={opt} className="choice-option-content" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubQuestionPreviewCard({
  sub,
  subNumber,
  optionLabelStyle,
}: {
  sub: SubQuestion;
  subNumber: number;
  optionLabelStyle: OptionLabelStyle;
}) {
  return (
    <div className={PREVIEW_CARD_CLASS}>
      <div className="flex items-start gap-2 mb-3">
        <span className="text-gray-900 font-bold shrink-0 text-base leading-[1.7]">{subNumber}.</span>
        <div className="flex-1 min-w-0 text-gray-800 leading-[1.7]">
          {!isHtmlEmpty(sub.content) ? (
            isFillInQuestion(sub) ? (
              <FillInQuestionContent html={sub.content} questionNumber={subNumber} className="text-sm" />
            ) : (
              <RichHtmlContent html={sub.content} className="text-sm" />
            )
          ) : (
            <span className="text-gray-400 italic text-sm">暫無題目內容</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {QUESTION_TYPE_LABELS[sub.type]}
        <span className="ml-2 text-amber-700">· {sub.points} 分</span>
      </p>

      {isChoiceQuestion(sub) && <ChoiceOptionsPreview question={sub} labelStyle={optionLabelStyle} />}

      {isTrueFalseQuestion(sub) && (
        <div className="flex gap-6 text-sm">
          <span className={sub.correctAnswer ? 'font-bold text-emerald-700' : 'text-gray-600'}>○ 是</span>
          <span className={!sub.correctAnswer ? 'font-bold text-emerald-700' : 'text-gray-600'}>✕ 否</span>
        </div>
      )}

      {isFillInQuestion(sub) && (
        <div className="space-y-2">
          {sub.cells.map((cell) => (
            <div key={cell.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-xs font-semibold text-gray-800 shrink-0">{cell.label}</span>
              <div className="flex flex-wrap items-end gap-3">
                {GRID_CELL_ANSWERS.map((ans) => (
                  <div key={ans} className="flex flex-col items-center gap-1 min-w-[1.5rem]">
                    <span className="text-xs text-gray-700 font-mono">{GRID_CELL_ANSWER_LABELS[ans]}</span>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 ${
                        cell.correctAnswer === ans
                          ? 'border-primary bg-primary'
                          : 'border-gray-400 bg-white'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isShortAnswerQuestion(sub) && (
        <div className="space-y-2">
          <div className="border border-dashed border-gray-300 bg-white/70 rounded-lg h-20 flex items-center justify-center text-sm text-gray-400">
            簡答作答區
          </div>
          {sub.referenceAnswer?.trim() && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-800 mb-1">參考答案</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{sub.referenceAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestionPreviewPanel({
  question,
  questionNumber,
  totalInQuiz,
  optionLabelStyle = 'letter_paren',
  subQuestionNumbers,
}: QuestionPreviewPanelProps) {
  if (isGroupQuestion(question)) {
    return (
      <div className="h-full flex flex-col">
        <p className="text-sm text-gray-500 mb-4">題目數：{totalInQuiz} 題</p>
        <div className="flex-1 space-y-4">
          <div className={PREVIEW_CARD_CLASS}>
            <p className="text-xs font-semibold text-primary mb-3">題組題幹</p>
            <div className="text-gray-800">
              {isHtmlEmpty(question.content) ? (
                <span className="text-gray-400 italic">暫無題目內容</span>
              ) : (
                <RichHtmlContent html={question.content} />
              )}
            </div>
          </div>

          {question.subQuestions.length === 0 ? (
            <p className="text-sm text-gray-400 italic px-1">尚無子題</p>
          ) : (
            question.subQuestions.map((sub) => (
              <SubQuestionPreviewCard
                key={sub.id}
                sub={sub}
                subNumber={subQuestionNumbers?.get(sub.id) ?? 0}
                optionLabelStyle={optionLabelStyle}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-500 mb-4">題目數：{totalInQuiz} 題</p>

      <div className={`flex-1 ${PREVIEW_CARD_CLASS}`}>
        <div className="flex items-start gap-2 mb-3">
          <span className="text-gray-900 font-bold shrink-0 text-base leading-[1.7]">{questionNumber}.</span>
          <div className="flex-1 min-w-0 text-gray-800 leading-[1.7]">
            {isHtmlEmpty(question.content) ? (
              <span className="text-gray-400 italic">暫無題目內容</span>
            ) : isFillInQuestion(question) ? (
              <FillInQuestionContent html={question.content} questionNumber={questionNumber} />
            ) : (
              <RichHtmlContent html={question.content} />
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {QUESTION_TYPE_LABELS[question.type]}
          <span className="ml-2 text-amber-700">· {question.points} 分</span>
        </p>

        {isChoiceQuestion(question) && (
          <ChoiceOptionsPreview question={question} labelStyle={optionLabelStyle} />
        )}

        {isTrueFalseQuestion(question) && (
          <div className="flex gap-6 text-sm">
            <span className={question.correctAnswer ? 'font-bold text-emerald-700' : 'text-gray-600'}>○ 是</span>
            <span className={!question.correctAnswer ? 'font-bold text-emerald-700' : 'text-gray-600'}>✕ 否</span>
          </div>
        )}

        {isFillInQuestion(question) && (
          <div className="space-y-3">
            {question.cells.map((cell) => (
              <div key={cell.id} className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="text-sm font-semibold text-gray-800 shrink-0 min-w-[3rem]">
                  {cell.label}
                </span>
                <div className="flex flex-wrap items-end gap-4">
                  {GRID_CELL_ANSWERS.map((ans) => (
                    <div key={ans} className="flex flex-col items-center gap-1.5 min-w-[1.75rem]">
                      <span className="text-sm text-gray-700 font-mono">{GRID_CELL_ANSWER_LABELS[ans]}</span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          cell.correctAnswer === ans
                            ? 'border-primary bg-primary'
                            : 'border-gray-400 bg-white'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isShortAnswerQuestion(question) && (
          <div className="space-y-2">
            <div className="border border-dashed border-gray-300 bg-white/70 rounded-lg h-24 flex items-center justify-center text-sm text-gray-400">
              簡答作答區
            </div>
            {question.referenceAnswer?.trim() && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-800 mb-1">參考答案</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.referenceAnswer}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
