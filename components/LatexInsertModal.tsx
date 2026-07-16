'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { katexRenderToString } from '@/utils/quillFormula';
import { makeFillInBlankToken } from '@/utils/fillInContent';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LatexInsertModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string, displayMode: boolean) => void;
  editMode?: boolean;
  initialLatex?: string;
  initialDisplayMode?: boolean;
  /** 選填題：可在公式內插入 [[-N]] 占位符 */
  fillInCellLabels?: string[];
  fillInQuestionNumber?: number;
}

const MATRIX_MAX = 8;

const EXAMPLES = [
  { label: '分數', latex: '\\frac{a}{b}' },
  { label: '根號', latex: '\\sqrt{x}' },
  { label: '次方', latex: 'x^{2}' },
  { label: '求和', latex: '\\sum\\limits_{i=1}^{n} i' },
  { label: '積分', latex: '\\int\\limits_{a}^{b} f(x)\\,dx' },
];

function defaultMatrixCell(row: number, col: number): string {
  return `a_{${row + 1}${col + 1}}`;
}

function createMatrixCells(rows: number, cols: number, prev?: string[][]): string[][] {
  const safeRows = Math.min(MATRIX_MAX, Math.max(1, rows));
  const safeCols = Math.min(MATRIX_MAX, Math.max(1, cols));
  return Array.from({ length: safeRows }, (_, r) =>
    Array.from({ length: safeCols }, (_, c) => prev?.[r]?.[c] ?? defaultMatrixCell(r, c))
  );
}

/** 產生中括號矩陣 LaTeX（bmatrix） */
export function buildBmatrixLatex(cells: string[][]): string {
  const body = cells
    .map((row) =>
      row
        .map((cell) => {
          const trimmed = cell.trim();
          return trimmed || '\\phantom{.}';
        })
        .join(' & ')
    )
    .join(' \\\\ ');
  return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
}

export default function LatexInsertModal({
  open,
  onClose,
  onInsert,
  editMode = false,
  initialLatex = '',
  initialDisplayMode = false,
  fillInCellLabels = [],
  fillInQuestionNumber,
}: LatexInsertModalProps) {
  const [mounted, setMounted] = useState(false);
  const [latex, setLatex] = useState('');
  const [displayMode, setDisplayMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [matrixCells, setMatrixCells] = useState<string[][]>(() => createMatrixCells(2, 2));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const selectionRef = React.useRef({ start: 0, end: 0 });

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setDisplayMode(initialDisplayMode);
      setPreviewHtml('');
      setPreviewError('');
      setMatrixOpen(false);
      setMatrixRows(2);
      setMatrixCols(2);
      setMatrixCells(createMatrixCells(2, 2));
      const len = initialLatex.length;
      selectionRef.current = { start: len, end: len };
    } else {
      setLatex('');
      setDisplayMode(false);
      setPreviewHtml('');
      setPreviewError('');
      setMatrixOpen(false);
      selectionRef.current = { start: 0, end: 0 };
    }
  }, [open, initialLatex, initialDisplayMode]);

  // 開啟後強制聚焦輸入框（避開 Quill contenteditable 搶焦點）
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const focusInput = () => {
      if (cancelled) return;
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    };
    const t1 = window.setTimeout(focusInput, 0);
    const t2 = window.setTimeout(focusInput, 50);
    const t3 = window.setTimeout(focusInput, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [open, initialLatex]);

  useEffect(() => {
    if (!latex.trim()) {
      setPreviewHtml('');
      setPreviewError('');
      return;
    }
    try {
      setPreviewHtml(
        katexRenderToString(latex, displayMode, {
          throwOnError: true,
          fillInQuestionNumber,
        })
      );
      setPreviewError('');
    } catch (err) {
      setPreviewHtml('');
      setPreviewError(err instanceof Error ? err.message : '公式語法錯誤');
    }
  }, [latex, displayMode, fillInQuestionNumber]);

  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    const { start: savedStart, end: savedEnd } = selectionRef.current;
    const start = el ? Math.min(savedStart, el.value.length) : savedStart;
    const end = el ? Math.min(savedEnd, el.value.length) : savedEnd;

    setLatex((prev) => {
      const next = prev.slice(0, start) + token + prev.slice(end);
      const pos = start + token.length;
      selectionRef.current = { start: pos, end: pos };
      return next;
    });

    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      const pos = start + token.length;
      target.setSelectionRange(pos, pos);
      selectionRef.current = { start: pos, end: pos };
    });
  };

  const resizeMatrix = (rows: number, cols: number) => {
    const safeRows = Math.min(MATRIX_MAX, Math.max(1, rows));
    const safeCols = Math.min(MATRIX_MAX, Math.max(1, cols));
    setMatrixRows(safeRows);
    setMatrixCols(safeCols);
    setMatrixCells((prev) => createMatrixCells(safeRows, safeCols, prev));
  };

  const updateMatrixCell = (row: number, col: number, value: string) => {
    setMatrixCells((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  const applyMatrix = () => {
    const generated = buildBmatrixLatex(matrixCells);
    insertAtCursor(generated);
    if (!displayMode) setDisplayMode(true);
  };

  const openMatrixBuilder = () => {
    setMatrixOpen(true);
    setMatrixRows(2);
    setMatrixCols(2);
    setMatrixCells(createMatrixCells(2, 2));
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/40"
      onMouseDown={(e) => {
        // 點遮罩外關閉；點內容時阻止冒泡，避免焦點回到 Quill
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] flex flex-col ${
          matrixOpen ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg">
            {editMode ? '編輯 LaTeX 公式' : initialLatex ? '轉換為公式' : '插入 LaTeX 公式'}
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-gray-700 text-sm font-bold mb-2 block">LaTeX 語法</label>
            {!!initialLatex && !editMode && (
              <p className="text-xs text-indigo-600 mb-2">
                已帶入選取的文字；確認預覽無誤後按「轉換為公式」。
              </p>
            )}
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => {
                setLatex(e.target.value);
                selectionRef.current = {
                  start: e.target.selectionStart,
                  end: e.target.selectionEnd,
                };
              }}
              onSelect={rememberSelection}
              onKeyUp={rememberSelection}
              onClick={rememberSelection}
              onBlur={rememberSelection}
              rows={3}
              placeholder={
                fillInCellLabels.length > 0
                  ? '例如：\\frac{[[-1]]}{[[-2]]}（可在公式內插入選填格）'
                  : '例如：\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}'
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {fillInCellLabels.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">插入選填格至公式（游標位置）</p>
              <div className="flex flex-wrap gap-2">
                {fillInCellLabels.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => insertAtCursor(makeFillInBlankToken(i + 1))}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                例：分數 <code className="text-emerald-700">\frac{'{[[-1]]}{[[-2]]}'}</code> 可將分子、分母設為選填格
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                checked={!displayMode}
                onChange={() => setDisplayMode(false)}
                className="accent-indigo-600"
              />
              行內公式
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                checked={displayMode}
                onChange={() => setDisplayMode(true)}
                className="accent-indigo-600"
              />
              獨立公式（置中）
            </label>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">預覽</p>
            <div className="min-h-[3rem] bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-center overflow-x-auto">
              {previewError ? (
                <span className="text-red-500 text-sm">{previewError}</span>
              ) : previewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <span className="text-gray-400 text-sm">輸入公式後即時預覽</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">常用範例（點擊插入至游標位置）</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  title={`插入 ${ex.latex}`}
                  onClick={() => {
                    setMatrixOpen(false);
                    insertAtCursor(ex.latex);
                  }}
                  className="px-3 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
              <button
                type="button"
                title="開啟矩陣編輯器"
                onClick={openMatrixBuilder}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  matrixOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                矩陣 [ ]
              </button>
            </div>
          </div>

          {matrixOpen && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">列數 m</label>
                  <input
                    type="number"
                    min={1}
                    max={MATRIX_MAX}
                    value={matrixRows}
                    onChange={(e) => resizeMatrix(Number(e.target.value) || 1, matrixCols)}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">欄數 n</label>
                  <input
                    type="number"
                    min={1}
                    max={MATRIX_MAX}
                    value={matrixCols}
                    onChange={(e) => resizeMatrix(matrixRows, Number(e.target.value) || 1)}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 pb-1.5">中括號矩陣，最多 {MATRIX_MAX}×{MATRIX_MAX}</p>
              </div>

              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-2 min-w-0"
                  style={{ gridTemplateColumns: `repeat(${matrixCols}, minmax(4.5rem, 1fr))` }}
                >
                  {matrixCells.map((row, r) =>
                    row.map((cell, c) => (
                      <input
                        key={`${r}-${c}`}
                        type="text"
                        value={cell}
                        onChange={(e) => updateMatrixCell(r, c, e.target.value)}
                        className="w-full min-w-[4.5rem] px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono bg-white"
                        placeholder={`a_{${r + 1}${c + 1}}`}
                      />
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={applyMatrix}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                套用矩陣（插入至游標）
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!latex.trim() || !!previewError}
            onClick={() => {
              onInsert(latex.trim(), displayMode);
              onClose();
            }}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-50"
          >
            {editMode ? '更新公式' : initialLatex ? '轉換為公式' : '插入公式'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
