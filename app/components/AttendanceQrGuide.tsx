'use client';

import React from 'react';
import { CameraIcon, QrCodeIcon } from '@heroicons/react/24/outline';

interface AttendanceQrGuideProps {
  /** 已從系統相機掃碼帶入 token，正在自動簽到 */
  isSubmitting?: boolean;
  /** 是否已帶入 token（掃碼後自動簽到中） */
  hasToken?: boolean;
}

/**
 * QR 點名統一引導學生使用手機內建相機掃碼（不使用網頁內建相機）。
 * 掃碼後會開啟簽到連結；未登入者登入後會自動完成簽到。
 */
export default function AttendanceQrGuide({ isSubmitting, hasToken }: AttendanceQrGuideProps) {
  if (hasToken || isSubmitting) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/10 p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <QrCodeIcon className="w-7 h-7 animate-pulse" />
        </div>
        <p className="text-primary font-bold">正在完成簽到…</p>
        <p className="text-sm text-primary/80">已辨識掃碼結果，請稍候</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <label className="block text-sm font-medium text-gray-600 mb-2">開始簽到</label>
        <p className="text-xs text-gray-500">
          請使用手機內建「相機」掃描老師出示的簽到 QR
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/10 p-5 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-white border border-primary/20 text-primary flex items-center justify-center shadow-sm">
          <CameraIcon className="w-8 h-8" />
        </div>

        <ol className="text-left text-sm text-gray-700 space-y-2.5 max-w-xs mx-auto">
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span>打開手機內建「相機」App（不要用其他掃碼 App）</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <span>對準老師螢幕上的簽到 QR Code</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span>點擊畫面提示的連結；若尚未登入，輸入帳密後會自動完成簽到</span>
          </li>
        </ol>

        <p className="text-xs text-gray-500 leading-relaxed px-1">
          掃碼連結會直接進入本站簽到頁。已登入會立即簽到；未登入請先完成登入即可成功簽到。
        </p>
      </div>
    </div>
  );
}
