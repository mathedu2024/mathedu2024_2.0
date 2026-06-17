"use client";
import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

type Props = {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ value = "", onChange, placeholder }: Props) {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "clean"],
      ],
      clipboard: { matchVisual: false },
    }),
    []
  );

  const formats = ["size", "bold", "italic", "underline", "color", "background", "list", "link"];

  const toolbarStyle = `
    .ql-toolbar .ql-picker,
    .ql-toolbar .ql-picker .ql-picker-label,
    .ql-toolbar .ql-picker .ql-picker-options,
    .ql-toolbar .ql-picker:not(.ql-color-picker) .ql-picker-item,
    .ql-toolbar .ql-picker:not(.ql-color-picker) .ql-picker-item:hover,
    .ql-toolbar .ql-picker:not(.ql-color-picker) .ql-picker-item.ql-selected {
      background-color: #ffffff !important;
      color: #111 !important;
    }

    .ql-toolbar .ql-picker {
      border-color: #d1d5db !important;
    }

    /* 給予所有按鈕不透明白底，防止互相透出 */
    .ql-toolbar button {
      background-color: #ffffff !important;
    }

    /* 讓所有功能群組擁有基礎層級，當有選單展開時，將該群組拉到最頂層 */
    .ql-toolbar .ql-formats {
      position: relative;
      z-index: 1;
    }
    .ql-toolbar .ql-formats:has(.ql-picker.ql-expanded) {
      z-index: 100000 !important;
    }

    .ql-toolbar .ql-picker.ql-expanded {
      z-index: 100000 !important;
    }

    .ql-toolbar .ql-picker.ql-expanded .ql-picker-label {
      background-color: #ffffff !important;
    }

    .ql-toolbar .ql-picker.ql-expanded .ql-picker-options {
      z-index: 100000 !important;
      position: absolute !important;
      background-color: #ffffff !important;
      opacity: 1 !important;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12) !important;
      border: 1px solid #d1d5db !important;
      border-radius: 0.5rem !important;
      overflow: hidden !important;
    }

    .ql-toolbar .ql-picker:not(.ql-color-picker).ql-expanded .ql-picker-item,
    .ql-toolbar .ql-picker:not(.ql-color-picker) .ql-picker-item {
      background-color: #ffffff !important;
      opacity: 1 !important;
      color: #111 !important;
    }

    .ql-toolbar select.ql-size,
    .ql-toolbar select.ql-list,
    .ql-toolbar select.ql-color,
    .ql-toolbar select.ql-background {
      background-color: #ffffff !important;
      color: #111 !important;
      -webkit-appearance: none !important;
      appearance: none !important;
    }

    .ql-toolbar select.ql-size option,
    .ql-toolbar select.ql-list option,
    .ql-toolbar select.ql-color option,
    .ql-toolbar select.ql-background option {
      background-color: #ffffff !important;
      color: #111 !important;
    }

    .ql-toolbar,
    .ql-container,
    .ql-editor {
      overflow: visible !important;
    }

    .ql-toolbar {
      position: relative !important;
      z-index: 100 !important;
      background-color: #ffffff !important;
    }

    .ql-container {
      position: relative !important;
      z-index: 10 !important;
    }

    .ql-toolbar .ql-picker-options {
      min-width: 7rem !important;
      background-color: #ffffff !important;
      opacity: 1 !important;
    }

    /* 解決中文輸入法 (IME) 組合文字時，Placeholder 沒消失造成字體重疊看不見的問題 */
    .ql-editor:focus::before {
      display: none !important;
    }

    /* 修正列點與數字的垂直對齊問題，確保對齊中文文字中間 */
    .ql-editor li::before {
      line-height: inherit !important;
    }

    .ql-snow .ql-size-small {
      font-size: 0.85em;
    }
    .ql-snow .ql-size-large {
      font-size: 1.5em;
    }
    .ql-snow .ql-size-huge {
      font-size: 2.5em;
    }

    @media (max-width: 640px) {
      .ql-toolbar {
        gap: 0.2rem;
      }
      .ql-toolbar .ql-formats button,
      .ql-toolbar .ql-formats .ql-picker {
        transform: scale(1);
        min-width: 1.9rem;
        min-height: 1.9rem;
      }
    }
  `;

  return (
    <div>
      <style>{toolbarStyle}</style>
      <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} formats={formats} placeholder={placeholder} />
    </div>
  );
}
