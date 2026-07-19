"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import LatexInsertModal from "./LatexInsertModal";
import {
  registerQuillFormula,
  resolveFormulaEmbedIndex,
  normalizeLatexLimits,
  renderFormulaIntoElement,
  readFormulaLatexFromElement,
} from "@/utils/quillFormula";
import { renderRichHtmlInElement } from "@/utils/richHtmlPipeline";
import { editorHtmlFromStorage, storageHtmlFromEditor, stripRenderedEmbedsForStorage } from "@/utils/fillInContent";
import { useQuizImageContext } from "@/components/quiz/QuizImageContext";
import { createLocalQuizImagePreview } from "@/utils/quizImageUpload";
import { QUIZ_MAX_IMAGES_PER_QUIZ } from "@/utils/quizImageLimits";
import { renderLatexInElement } from "@/utils/quillFormula";

type Props = {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  /** 精簡工具列（適用選項等較小欄位） */
  compact?: boolean;
  /** 編輯區最小高度 */
  minHeight?: string;
  className?: string;
  /** 是否啟用 LaTeX 公式按鈕 */
  enableLatex?: boolean;
  /** 是否顯示字體大小選項（測驗編輯建議關閉） */
  enableFontSize?: boolean;
  /** 僅顯示 LaTeX 公式編輯器（適用選項欄位） */
  latexOnly?: boolean;
  /** 選填題：公式編輯器可插入 [[-N]] 占位符 */
  fillInCellLabels?: string[];
  fillInQuestionNumber?: number;
  /** 切換編輯對象時傳入不同 key，避免殘留上一筆內容 */
  instanceKey?: string;
};

export type RichTextEditorHandle = {
  /** 於游標位置插入選填格（文字題幹）；公式內請改用 LaTeX 編輯視窗 */
  insertFillInToken: (token: string) => void;
  flushPendingChange: () => void;
};

/** ReactQuill.getEditor() 在尚未掛載時會 throw，不可只用 optional chaining */
function safeGetQuill(
  ref: React.RefObject<ReactQuill | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  try {
    const instance = ref.current;
    if (!instance) return null;
    return instance.getEditor();
  } catch {
    return null;
  }
}

function stringArraysEqual(a?: string[], b?: string[]): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** 從選取文字取出可編輯的 LaTeX（支援 $...$ / $$...$$ / \(...\) / \[...\]） */
function extractLatexFromSelectedText(raw: string): { latex: string; displayMode: boolean } {
  let text = raw.replace(/\u00a0/g, ' ').trim();
  // Quill getText 常在結尾帶換行
  text = text.replace(/\n+$/g, '').trim();
  if (!text) return { latex: '', displayMode: false };

  const displayMode = false;

  // 僅在「整段選取剛好是一組」分隔符時才剝除，避免 $$a$$ … $$b$$ 被貪心吃成一大塊
  const blockDollar = /^\$\$([\s\S]*?)\$\$$/.exec(text);
  if (blockDollar && blockDollar[0] === text && !/\$\$/.test(blockDollar[1])) {
    return { latex: blockDollar[1].trim(), displayMode: true };
  }
  const blockBracket = /^\\\[([\s\S]*?)\\\]$/.exec(text);
  if (blockBracket && blockBracket[0] === text) {
    return { latex: blockBracket[1].trim(), displayMode: true };
  }
  if (/^\\begin\{[\s\S]+\}$/.test(text)) {
    return { latex: text, displayMode: true };
  }
  const inlineDollar = /^\$([^$]+)\$$/.exec(text);
  if (inlineDollar && inlineDollar[0] === text) {
    return { latex: inlineDollar[1].trim(), displayMode: false };
  }
  const inlineParen = /^\\\(([\s\S]*?)\\\)$/.exec(text);
  if (inlineParen && inlineParen[0] === text) {
    return { latex: inlineParen[1].trim(), displayMode: false };
  }

  return { latex: text, displayMode };
}

function richTextEditorPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.value === next.value &&
    prev.compact === next.compact &&
    prev.placeholder === next.placeholder &&
    prev.minHeight === next.minHeight &&
    prev.className === next.className &&
    prev.enableLatex === next.enableLatex &&
    prev.enableFontSize === next.enableFontSize &&
    prev.latexOnly === next.latexOnly &&
    prev.fillInQuestionNumber === next.fillInQuestionNumber &&
    prev.instanceKey === next.instanceKey &&
    stringArraysEqual(prev.fillInCellLabels, next.fillInCellLabels)
  );
}

type QuillLeaf = {
  statics?: { blotName?: string };
  domNode?: HTMLElement;
  value?: () => string;
  length?: () => number;
};

function isFormulaOrBlankEmbed(blot: QuillLeaf | null | undefined): boolean {
  if (!blot) return false;
  const name = blot.statics?.blotName;
  if (name === 'formula' || name === 'formula-block' || name === 'fill-in-blank') return true;
  const node = blot.domNode;
  return !!(
    node?.classList.contains('ql-formula') ||
    node?.classList.contains('ql-formula-block') ||
    node?.classList.contains('fill-in-blank-embed')
  );
}

/** 游標是否緊接在公式／選填格 embed 之後（中間僅空白） */
function cursorFollowsFormulaEmbed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quill: any,
  index: number
): boolean {
  if (index <= 0) return false;

  let pos = index;
  while (pos > 0) {
    const [leaf, offset] = quill.getLeaf(pos) as [QuillLeaf | null, number];
    if (!leaf) break;

    if (leaf.statics?.blotName === 'text') {
      const text = leaf.value?.() ?? '';
      const before = text.slice(0, offset);
      if (before.length > 0) {
        if (!/^\s+$/.test(before)) return false;
        pos -= before.length;
        continue;
      }
      const [prev] = quill.getLeaf(Math.max(0, pos - 1)) as [QuillLeaf | null, number];
      return isFormulaOrBlankEmbed(prev);
    }

    if (isFormulaOrBlankEmbed(leaf)) {
      const len = leaf.length?.() ?? 1;
      return offset >= len;
    }

    const [prev] = quill.getLeaf(Math.max(0, pos - 1)) as [QuillLeaf | null, number];
    return isFormulaOrBlankEmbed(prev);
  }

  return false;
}

const RichTextEditor = React.forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  {
    value = "",
    onChange,
    placeholder,
    compact = false,
    minHeight,
    className = "",
    enableLatex = true,
    enableFontSize = true,
    latexOnly = false,
    fillInCellLabels = [],
    fillInQuestionNumber,
    instanceKey,
  },
  ref
) {
  const editorRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ index: number; length: number } | null>(null);
  const editingFormulaRef = useRef<{
    index: number | null;
    displayMode: boolean;
    element?: HTMLElement;
  } | null>(null);
  const [latexModalOpen, setLatexModalOpen] = useState(false);
  const [latexEditMode, setLatexEditMode] = useState(false);
  const [latexInitial, setLatexInitial] = useState<{ latex: string; displayMode: boolean } | null>(null);
  const [formulaReady, setFormulaReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const quizImageContext = useQuizImageContext();
  const enableQuizImage = Boolean(quizImageContext);
  const isFillInEditor = fillInQuestionNumber !== undefined;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const openLatexModalRef = useRef<() => void>(() => {});
  const openImagePickerRef = useRef<() => void>(() => {});
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const lastEmittedRef = useRef(value);

  const equivalentEditorHtml = useCallback((a: string, b: string) => {
    if (a === b) return true;
    const norm = (s: string) =>
      stripRenderedEmbedsForStorage(
        (s ?? '')
          .replace(/<p><br><\/p>/gi, '<p></p>')
          .replace(/<p>\s*<\/p>/gi, '<p></p>')
          .trim()
      );
    return norm(a) === norm(b);
  }, []);

  const toDisplayHtml = useCallback(
    (html: string) => {
      if (!html || !isFillInEditor) return html;
      return editorHtmlFromStorage(html, fillInQuestionNumber);
    },
    [isFillInEditor, fillInQuestionNumber]
  );

  const [localHtml, setLocalHtml] = useState(() => toDisplayHtml(value ?? ''));
  const localHtmlRef = useRef(localHtml);
  localHtmlRef.current = localHtml;
  const debounceTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const prevInstanceKeyRef = useRef(instanceKey);

  useEffect(() => {
    if (instanceKey === undefined) return;
    if (prevInstanceKeyRef.current === instanceKey) return;
    prevInstanceKeyRef.current = instanceKey;
    lastEmittedRef.current = value;
    setLocalHtml(toDisplayHtml(value ?? ''));
  }, [instanceKey, value, toDisplayHtml]);

  useEffect(() => {
    if (isComposingRef.current || isFocusedRef.current) return;
    if (value === lastEmittedRef.current) return;
    const display = toDisplayHtml(value ?? '');
    if (equivalentEditorHtml(display, localHtmlRef.current)) {
      lastEmittedRef.current = value;
      return;
    }
    if (equivalentEditorHtml(value ?? '', lastEmittedRef.current ?? '')) {
      lastEmittedRef.current = value;
      return;
    }
    lastEmittedRef.current = value;
    setLocalHtml(display);
  }, [value, toDisplayHtml, equivalentEditorHtml]);

  useEffect(() => {
    setMounted(true);
    void registerQuillFormula().then(() => setFormulaReady(true));
  }, []);

  const decorateToolbarLabels = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const setTip = (el: Element | null, label: string) => {
      if (!el || !(el instanceof HTMLElement)) return;
      el.setAttribute('title', label);
      el.setAttribute('aria-label', label);
    };

    const buttonTips: Array<[string, string]> = [
      ['button.ql-bold', '粗體'],
      ['button.ql-italic', '斜體'],
      ['button.ql-underline', '底線'],
      ['button.ql-link', '插入連結'],
      ['button.ql-clean', '清除格式'],
      ['button.ql-image', '插入圖片'],
      ['button.ql-latex', '插入／轉換 LaTeX 公式（可先選取文字；已插入的公式可點擊編輯）'],
      ['button.ql-list[value="ordered"]', '編號清單'],
      ['button.ql-list[value="bullet"]', '項目符號'],
    ];
    for (const [selector, label] of buttonTips) {
      root.querySelectorAll(selector).forEach((el) => setTip(el, label));
    }

    setTip(root.querySelector('.ql-picker.ql-size .ql-picker-label'), '字級');
    setTip(root.querySelector('.ql-picker.ql-color .ql-picker-label'), '文字顏色');
    setTip(root.querySelector('.ql-picker.ql-background .ql-picker-label'), '背景顏色');

    const latexBtn = root.querySelector<HTMLButtonElement>('button.ql-latex');
    if (latexBtn && enableLatex) {
      latexBtn.setAttribute('type', 'button');
      setTip(latexBtn, '插入／轉換 LaTeX 公式（可先選取文字；已插入的公式可點擊編輯）');
      // 避免點工具列時讓 Quill 先清掉選取／搶焦點
      if (!latexBtn.dataset.latexMousedownBound) {
        latexBtn.dataset.latexMousedownBound = '1';
        latexBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
        });
      }
    }
  }, [enableLatex]);

  useEffect(() => {
    if (!mounted || !formulaReady) return;
    decorateToolbarLabels();
    const timer = window.setTimeout(decorateToolbarLabels, 50);
    return () => window.clearTimeout(timer);
  }, [mounted, formulaReady, decorateToolbarLabels, compact, latexOnly, enableQuizImage]);

  // Quill 字級／顏色下拉會被 modal、overflow-hidden 父層裁切；展開時暫時解除祖先 overflow
  useEffect(() => {
    if (!mounted || !formulaReady) return;
    const root = containerRef.current;
    if (!root) return;

    type OverflowBackup = {
      el: HTMLElement;
      overflow: string;
      overflowX: string;
      overflowY: string;
    };
    let backups: OverflowBackup[] = [];

    const restoreOverflow = () => {
      for (const b of backups) {
        b.el.style.overflow = b.overflow;
        b.el.style.overflowX = b.overflowX;
        b.el.style.overflowY = b.overflowY;
      }
      backups = [];
      root.classList.remove('picker-open');
    };

    const unlockOverflowAncestors = () => {
      restoreOverflow();
      root.classList.add('picker-open');
      let el: HTMLElement | null = root.parentElement;
      while (el && el !== document.documentElement) {
        const cs = window.getComputedStyle(el);
        const clips =
          cs.overflow !== 'visible' ||
          cs.overflowX !== 'visible' ||
          cs.overflowY !== 'visible';
        if (clips) {
          backups.push({
            el,
            overflow: el.style.overflow,
            overflowX: el.style.overflowX,
            overflowY: el.style.overflowY,
          });
          el.style.overflow = 'visible';
          el.style.overflowX = 'visible';
          el.style.overflowY = 'visible';
        }
        el = el.parentElement;
      }
    };

    const syncPickerState = () => {
      const expanded = root.querySelector('.ql-picker.ql-expanded');
      if (expanded) unlockOverflowAncestors();
      else restoreOverflow();
    };

    const observer = new MutationObserver(syncPickerState);
    const observePickers = () => {
      root.querySelectorAll('.ql-picker').forEach((picker) => {
        observer.observe(picker, { attributes: true, attributeFilter: ['class'] });
      });
    };
    observePickers();
    const readyTimer = window.setTimeout(observePickers, 80);

    const onScrollOrResize = () => {
      if (root.querySelector('.ql-picker.ql-expanded')) unlockOverflowAncestors();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.clearTimeout(readyTimer);
      observer.disconnect();
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      restoreOverflow();
    };
  }, [mounted, formulaReady, compact, latexOnly, enableFontSize, enableQuizImage]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingContentRef.current !== null) {
        let stored = isFillInEditor
          ? storageHtmlFromEditor(pendingContentRef.current)
          : pendingContentRef.current;
        stored = stripRenderedEmbedsForStorage(stored);
        lastEmittedRef.current = stored;
        onChangeRef.current?.(stored);
        pendingContentRef.current = null;
      }
    },
    // 僅在卸載時 flush，避免 onChange 每次重建就清掉其他選項的公式
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const closeLatexModal = useCallback(() => {
    setLatexModalOpen(false);
    setLatexEditMode(false);
    setLatexInitial(null);
    editingFormulaRef.current = null;
    selectionRef.current = null;
  }, []);

  const openFormulaForEdit = useCallback((formulaEl: HTMLElement) => {
    const latex = readFormulaLatexFromElement(formulaEl);
    if (!latex) return false;

    const quill = safeGetQuill(editorRef);
    const isBlock = formulaEl.classList.contains('ql-formula-block');
    const index = quill ? resolveFormulaEmbedIndex(quill, formulaEl) : null;

    editingFormulaRef.current = {
      index,
      displayMode: isBlock,
      element: formulaEl,
    };
    formulaEl.setAttribute('title', '點擊編輯公式');
    setLatexEditMode(true);
    setLatexInitial({ latex, displayMode: isBlock });
    setLatexModalOpen(true);
    return true;
  }, []);

  const openLatexModal = useCallback(() => {
    editingFormulaRef.current = null;
    setLatexEditMode(false);
    setLatexInitial(null);
    const quill = safeGetQuill(editorRef);
    if (quill) {
      // 勿用 getSelection(true)：會強制 focus 回編輯器，導致公式視窗無法輸入
      const sel = quill.getSelection(false);
      const safeSel = sel
        ? { index: sel.index, length: sel.length }
        : { index: Math.max(0, quill.getLength() - 1), length: 0 };
      selectionRef.current = safeSel;

      // 游標落在已插入的公式上 → 直接進入編輯
      if (safeSel.length === 0 || safeSel.length === 1) {
        try {
          const leafAt = (quill.getLeaf(safeSel.index) as [QuillLeaf | null, number])[0];
          const leafPrev =
            safeSel.index > 0
              ? (quill.getLeaf(safeSel.index - 1) as [QuillLeaf | null, number])[0]
              : null;
          const pickFormula = (blot: QuillLeaf | null) => {
            const node = blot?.domNode;
            if (!(node instanceof HTMLElement)) return null;
            return node.closest('.ql-formula, .ql-formula-block') as HTMLElement | null;
          };
          const candidate = pickFormula(leafAt) || pickFormula(leafPrev);
          if (candidate && openFormulaForEdit(candidate)) {
            try {
              (quill.root as HTMLElement).blur();
            } catch {
              /* ignore */
            }
            return;
          }
        } catch {
          /* fall through to insert / convert */
        }
      }

      if (safeSel.length > 0) {
        const selectedText = quill.getText(safeSel.index, safeSel.length);
        const extracted = extractLatexFromSelectedText(selectedText);
        if (extracted.latex) {
          setLatexInitial({ latex: extracted.latex, displayMode: extracted.displayMode });
        }
      }

      try {
        (quill.root as HTMLElement).blur();
      } catch {
        /* ignore */
      }
    } else {
      selectionRef.current = null;
    }
    setLatexModalOpen(true);
  }, [openFormulaForEdit]);
  openLatexModalRef.current = openLatexModal;

  useEffect(() => {
    if (!mounted || !formulaReady || !enableLatex) return;
    const container = containerRef.current;
    if (!container) return;

    // 單擊即可編輯（游標樣式已是 pointer）
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const formulaEl = target.closest('.ql-formula, .ql-formula-block') as HTMLElement | null;
      if (!formulaEl || !container.contains(formulaEl)) return;

      e.preventDefault();
      e.stopPropagation();
      openFormulaForEdit(formulaEl);
    };

    container.addEventListener('click', handleClick, true);
    return () => container.removeEventListener('click', handleClick, true);
  }, [enableLatex, formulaReady, mounted, openFormulaForEdit]);

  const emitChange = useCallback(
    (content: string) => {
      let stored = isFillInEditor ? storageHtmlFromEditor(content) : content;
      stored = stripRenderedEmbedsForStorage(stored);
      lastEmittedRef.current = stored;
      pendingContentRef.current = null;
      onChangeRef.current?.(stored);
    },
    [isFillInEditor]
  );

  const scheduleEmit = useCallback(
    (content: string) => {
      pendingContentRef.current = content;
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        emitChange(content);
      }, isFillInEditor ? 200 : 120);
    },
    [emitChange, isFillInEditor]
  );

  const decorateFillInEditor = useCallback(() => {
    if (!isFillInEditor) return;
    const quill = safeGetQuill(editorRef);
    if (!quill) return;
    const root = quill.root as HTMLElement;
    renderRichHtmlInElement(root, {
      fillInQuestionNumber,
      sanitize: false,
      convertDelimiters: false,
    });
  }, [isFillInEditor, fillInQuestionNumber]);

  const insertImageAtSelection = useCallback((url: string) => {
    const quill = safeGetQuill(editorRef);
    if (!quill || typeof quill.insertEmbed !== 'function') return;

    const saved = selectionRef.current;
    const index = saved?.index ?? Math.max(0, quill.getLength() - 1);
    quill.insertEmbed(index, 'image', url, 'user');
    quill.setSelection(index + 1, 0, 'user');

    const html = quill.root.innerHTML;
    setLocalHtml(html);
    emitChange(html);
    if (isFillInEditor) decorateFillInEditor();
    selectionRef.current = null;
  }, [emitChange, isFillInEditor, decorateFillInEditor]);

  const insertFillInTokenAtSelection = useCallback(
    (token: string) => {
      if (!isFillInEditor || !token) return;
      const quill = safeGetQuill(editorRef);
      if (!quill || typeof quill.insertEmbed !== 'function') {
        const next = `${localHtmlRef.current || ''}${token}`;
        setLocalHtml(next);
        emitChange(next);
        return;
      }

      const sel = quill.getSelection(true);
      const index = sel?.index ?? Math.max(0, quill.getLength() - 1);
      if (sel && sel.length > 0) {
        quill.deleteText(index, sel.length, 'user');
      }
      quill.insertEmbed(index, 'fill-in-blank', token, 'user');
      quill.setSelection(index + 1, 0, 'user');

      const html = quill.root.innerHTML;
      localHtmlRef.current = html;
      setLocalHtml(html);
      emitChange(html);
      decorateFillInEditor();
    },
    [decorateFillInEditor, emitChange, isFillInEditor]
  );

  const handleQuizImageUpload = useCallback(async (file: File) => {
    if (!quizImageContext) return;
    if (quizImageContext.getImageCount() >= QUIZ_MAX_IMAGES_PER_QUIZ) {
      window.alert(`每份測驗卷最多 ${QUIZ_MAX_IMAGES_PER_QUIZ} 張圖片`);
      return;
    }

    const quill = safeGetQuill(editorRef);
    if (quill) {
      const sel = quill.getSelection();
      selectionRef.current = sel
        ? { index: sel.index, length: sel.length }
        : { index: Math.max(0, quill.getLength() - 1), length: 0 };
    } else {
      selectionRef.current = null;
    }

    setImageUploading(true);
    try {
      const localUrl = await createLocalQuizImagePreview(file);
      insertImageAtSelection(localUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '圖片加入失敗');
    } finally {
      setImageUploading(false);
    }
  }, [quizImageContext, insertImageAtSelection]);

  const openImagePicker = useCallback(() => {
    if (imageUploading) return;
    imageInputRef.current?.click();
  }, [imageUploading]);
  openImagePickerRef.current = openImagePicker;

  const flushPendingChange = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingContentRef.current !== null) {
      emitChange(pendingContentRef.current);
      return;
    }
    const quill = safeGetQuill(editorRef);
    if (!quill) return;
    emitChange(quill.root.innerHTML);
  }, [emitChange]);

  React.useImperativeHandle(
    ref,
    () => ({
      insertFillInToken: insertFillInTokenAtSelection,
      flushPendingChange,
    }),
    [flushPendingChange, insertFillInTokenAtSelection]
  );

  useEffect(() => {
    if (!mounted || !formulaReady) return;

    let cancelled = false;
    let root: HTMLElement | null = null;
    let retryTimer: number | null = null;
    let onCompositionStart: (() => void) | null = null;
    let onCompositionEnd: (() => void) | null = null;
    let onFocus: (() => void) | null = null;
    let onBlur: (() => void) | null = null;

    const attach = () => {
      if (cancelled) return;
      const quill = safeGetQuill(editorRef);
      if (!quill) {
        retryTimer = window.setTimeout(attach, 50);
        return;
      }

      root = quill.root as HTMLElement;
      onCompositionStart = () => {
        isComposingRef.current = true;
      };
      onCompositionEnd = () => {
        isComposingRef.current = false;
        const html = root!.innerHTML;
        localHtmlRef.current = html;
        setLocalHtml((prev) => (prev === html ? prev : html));
        scheduleEmit(html);
      };
      onFocus = () => {
        isFocusedRef.current = true;
      };
      onBlur = () => {
        isFocusedRef.current = false;
        if (!isComposingRef.current) flushPendingChange();
        const html = root!.innerHTML;
        localHtmlRef.current = html;
        setLocalHtml((prev) => (prev === html ? prev : html));
        if (isFillInEditor) {
          decorateFillInEditor();
        }
      };

      root.addEventListener('compositionstart', onCompositionStart);
      root.addEventListener('compositionend', onCompositionEnd);
      root.addEventListener('focus', onFocus, true);
      root.addEventListener('blur', onBlur, true);
    };

    attach();

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (root && onCompositionStart && onCompositionEnd && onFocus && onBlur) {
        root.removeEventListener('compositionstart', onCompositionStart);
        root.removeEventListener('compositionend', onCompositionEnd);
        root.removeEventListener('focus', onFocus, true);
        root.removeEventListener('blur', onBlur, true);
      }
    };
  }, [mounted, formulaReady, isFillInEditor, flushPendingChange, decorateFillInEditor, scheduleEmit]);

  useEffect(() => {
    if (!mounted || !formulaReady || !isFillInEditor || isFocusedRef.current) return;
    decorateFillInEditor();
  }, [mounted, formulaReady, localHtml, isFillInEditor, decorateFillInEditor]);

  useEffect(() => {
    if (!mounted || !formulaReady || !enableLatex || isFocusedRef.current) return;
    const quill = safeGetQuill(editorRef);
    if (!quill) return;
    // 儲存格式可能只有 data-latex 空節點；補渲染讓點擊可編輯
    renderLatexInElement(quill.root as HTMLElement, fillInQuestionNumber);
  }, [mounted, formulaReady, enableLatex, localHtml, fillInQuestionNumber]);

  const handleInsertLatex = useCallback((latex: string, displayMode: boolean) => {
    const quill = safeGetQuill(editorRef);
    if (!quill || typeof quill.insertEmbed !== "function") return;

    const editing = editingFormulaRef.current;
    if (editing) {
      const normalized = normalizeLatexLimits(latex);
      if (editing.index !== null) {
        quill.deleteText(editing.index, 1, "user");
        if (displayMode) {
          quill.insertText(editing.index, "\n", "user");
          quill.insertEmbed(editing.index + 1, "formula-block", normalized, "user");
          quill.insertText(editing.index + 2, "\n", "user");
          quill.setSelection(editing.index + 3, 0, "user");
        } else {
          quill.insertEmbed(editing.index, "formula", normalized, "user");
          quill.setSelection(editing.index + 1, 0, "user");
        }
        const html = quill.root.innerHTML;
        setLocalHtml(html);
        emitChange(html);
        if (isFillInEditor) decorateFillInEditor();
      } else if (editing.element) {
        const el = editing.element;
        el.setAttribute("data-latex", normalized);
        el.setAttribute("title", "點擊編輯公式");
        el.className = displayMode ? "ql-formula-block" : "ql-formula";
        el.innerHTML = "";
        try {
          renderFormulaIntoElement(el, normalized, displayMode, fillInQuestionNumber);
        } catch {
          el.textContent = normalized;
        }
        const html = quill.root.innerHTML;
        setLocalHtml(html);
        emitChange(html);
        if (isFillInEditor) decorateFillInEditor();
      }
      editingFormulaRef.current = null;
      setLatexEditMode(false);
      setLatexInitial(null);
      return;
    }

    const saved = selectionRef.current;
    const index = saved?.index ?? Math.max(0, quill.getLength() - 1);
    const length = saved?.length ?? 0;

    // 有選取文字時：刪除原文後插入公式（LaTeX → 網站方程式樣式）
    if (length > 0) {
      quill.deleteText(index, length, "user");
    }

    const normalized = normalizeLatexLimits(latex);
    // 轉換選取文字時不要插入換行，避免把整段題幹拆開（尤其是 $$...$$）
    if (displayMode && length === 0) {
      quill.insertText(index, "\n", "user");
      quill.insertEmbed(index + 1, "formula-block", normalized, "user");
      quill.insertText(index + 2, "\n", "user");
      quill.setSelection(index + 3, 0, "user");
    } else if (displayMode) {
      quill.insertEmbed(index, "formula-block", normalized, "user");
      quill.setSelection(index + 1, 0, "user");
    } else {
      quill.insertEmbed(index, "formula", normalized, "user");
      quill.setSelection(index + 1, 0, "user");
    }

    const html = quill.root.innerHTML;
    setLocalHtml(html);
    emitChange(html);
    if (isFillInEditor) decorateFillInEditor();
    selectionRef.current = null;
  }, [emitChange, fillInQuestionNumber, isFillInEditor, decorateFillInEditor]);

  const handleChange = useCallback(
    (
      content: string,
      _delta: unknown,
      source: string,
      _editor: { getSelection: () => { index: number; length: number } | null }
    ) => {
      localHtmlRef.current = content;

      // 必須用與 Quill onChange 完全相同的字串更新受控 value，
      // 否則父層重渲染時會 setContents 舊 HTML，游標／內容錯亂。
      // 不要在這裡手動 setSelection：text-change 當下的 selection 常是舊位置，
      // 強制還原會造成「游標往前跑」。
      setLocalHtml((prev) => (prev === content ? prev : content));

      if (isComposingRef.current) return;
      if (source === 'user' || source === 'api') {
        scheduleEmit(content);
      }
    },
    [scheduleEmit]
  );
  const spaceNearEmbedHandler = useCallback(function (
    this: { quill: { insertText: (i: number, t: string, s: string) => void; setSelection: (i: number, l: number, s: string) => void; getSelection: () => { index: number; length: number } | null } },
    range: { index: number; length: number }
  ) {
    const quill = this.quill;
    if (!range || range.length > 0) return true;
    if (!cursorFollowsFormulaEmbed(quill, range.index)) return true;

    quill.insertText(range.index, ' ', 'user');
    quill.setSelection(range.index + 1, 0, 'silent');
    return false;
  }, []);

  const fullToolbar = useMemo(() => {
    const sizeRow = enableFontSize ? [[{ size: ["small", false, "large", "huge"] }]] : [];
    const trailingTools = [
      ...(enableQuizImage ? ["image"] : []),
      ...(enableLatex ? ["latex"] : []),
      "clean",
    ];
    const formatRows = [
      ["bold", "italic", "underline"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", ...trailingTools],
    ];
    return [...sizeRow, ...formatRows];
  }, [enableFontSize, enableLatex, enableQuizImage]);

  const compactToolbar = useMemo(() => {
    const trailingTools = [
      ...(enableQuizImage ? ["image"] : []),
      ...(enableLatex ? ["latex"] : []),
      "clean",
    ];
    return [["bold", "italic", "underline"], trailingTools];
  }, [enableLatex, enableQuizImage]);

  const latexOnlyToolbar = useMemo(() => {
    const trailingTools = [
      ...(enableQuizImage ? ["image"] : []),
      ...(enableLatex ? ["latex"] : []),
      "clean",
    ];
    return [trailingTools];
  }, [enableLatex, enableQuizImage]);

  const toolbarHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    if (enableLatex) handlers.latex = () => openLatexModalRef.current();
    if (enableQuizImage) handlers.image = () => openImagePickerRef.current();
    return Object.keys(handlers).length > 0 ? handlers : undefined;
  }, [enableLatex, enableQuizImage]);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: latexOnly ? latexOnlyToolbar : (compact ? compactToolbar : fullToolbar),
        handlers: toolbarHandlers,
      },
      clipboard: { matchVisual: false },
      keyboard: {
        bindings: {
          spaceNearFormulaEmbed: {
            key: ' ',
            collapsed: true,
            handler: spaceNearEmbedHandler,
          },
        },
      },
    }),
    [latexOnly, latexOnlyToolbar, compact, compactToolbar, fullToolbar, toolbarHandlers, spaceNearEmbedHandler]
  );

  const formats = useMemo(() => {
    if (latexOnly) {
      const base = enableLatex ? ["formula", "formula-block"] : [];
      if (fillInQuestionNumber !== undefined) base.push("fill-in-blank");
      if (enableQuizImage) base.push("image");
      return base;
    }
    const base = ["bold", "italic", "underline", "color", "background", "list", "link"];
    if (enableFontSize) base.unshift("size");
    if (enableLatex) base.push("formula", "formula-block");
    if (fillInQuestionNumber !== undefined) base.push("fill-in-blank");
    if (enableQuizImage) base.push("image");
    return base;
  }, [enableFontSize, enableLatex, latexOnly, fillInQuestionNumber, enableQuizImage]);

  const editorMinHeight = minHeight ?? (compact ? "72px" : "120px");

  return (
    <div
      ref={containerRef}
      className={`rich-text-editor rounded-xl border border-gray-300 overflow-visible bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent ${compact ? "compact" : ""} ${className}`}
      style={{ "--editor-min-height": editorMinHeight } as React.CSSProperties}
    >
      {mounted && formulaReady ? (
        <ReactQuill
          key={instanceKey ?? "default"}
          ref={editorRef}
          theme="snow"
          value={localHtml}
          onChange={handleChange}
          useSemanticHTML={false}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
        />
      ) : (
        <div
          className="ql-container ql-snow border-0 bg-white"
          style={{ minHeight: editorMinHeight }}
        >
          <div className="ql-editor text-gray-400" style={{ minHeight: editorMinHeight }}>
            {placeholder}
          </div>
        </div>
      )}
      {enableLatex && (
        <LatexInsertModal
          open={latexModalOpen}
          onClose={closeLatexModal}
          onInsert={handleInsertLatex}
          editMode={latexEditMode}
          initialLatex={latexInitial?.latex}
          initialDisplayMode={latexInitial?.displayMode}
          fillInCellLabels={fillInCellLabels}
          fillInQuestionNumber={fillInQuestionNumber}
        />
      )}
      {enableQuizImage && (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleQuizImageUpload(file);
          }}
        />
      )}
    </div>
  );
});

export default React.memo(RichTextEditor, richTextEditorPropsEqual);
