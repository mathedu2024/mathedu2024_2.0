'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ArrowsPointingOutIcon, QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AttendanceQrDisplayProps {
  courseId: string;
  activityId: string;
  /** ISO 截止時間；到點後 QR 自動消失並停止換碼 */
  endTime?: string | null;
  className?: string;
  onEnded?: () => void;
}

function parseEndMs(endTime?: string | null): number | null {
  if (!endTime) return null;
  const ms = new Date(endTime).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function AttendanceQrDisplay({
  courseId,
  activityId,
  endTime,
  className = '',
  onEnded,
}: AttendanceQrDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ended, setEnded] = useState(() => {
    const endMs = parseEndMs(endTime);
    return endMs !== null && Date.now() >= endMs;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const endMs = parseEndMs(endTime);
    if (endMs === null) return;

    if (Date.now() >= endMs) {
      setEnded(true);
      setIsFullscreen(false);
      onEnded?.();
      return;
    }

    const timer = window.setTimeout(() => {
      setEnded(true);
      setIsFullscreen(false);
      setQrDataUrl(null);
      onEnded?.();
    }, endMs - Date.now());

    return () => window.clearTimeout(timer);
  }, [endTime, onEnded]);

  const refreshToken = useCallback(async () => {
    const endMs = parseEndMs(endTime);
    if (endMs !== null && Date.now() >= endMs) {
      setEnded(true);
      setIsFullscreen(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/attendance/qr-token?courseId=${encodeURIComponent(courseId)}&activityId=${encodeURIComponent(activityId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        if (
          typeof data.error === 'string' &&
          (data.error.includes('已結束') || data.error.includes('尚未開始'))
        ) {
          setEnded(true);
          setIsFullscreen(false);
          setQrDataUrl(null);
          onEnded?.();
          return;
        }
        throw new Error(data.error || '無法取得簽到 QR');
      }

      const dataUrl = await QRCode.toDataURL(data.checkInUrl as string, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 720,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      });

      setQrDataUrl(dataUrl);
      setExpiresAt(Number(data.expiresAt) || Date.now() + 20000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入簽到 QR');
      setQrDataUrl(null);
    } finally {
      setLoading(false);
    }
  }, [courseId, activityId, endTime, onEnded]);

  useEffect(() => {
    if (ended) return;
    void refreshToken();
  }, [refreshToken, ended]);

  // 背景靜默換碼，不顯示倒數／間隔提示
  useEffect(() => {
    if (ended || !expiresAt) return;

    const scheduleRefresh = () => {
      const endMs = parseEndMs(endTime);
      if (endMs !== null && Date.now() >= endMs) {
        setEnded(true);
        setIsFullscreen(false);
        setQrDataUrl(null);
        onEnded?.();
        return null;
      }

      const delay = Math.max(500, expiresAt - Date.now());
      return window.setTimeout(() => {
        void refreshToken();
      }, delay);
    };

    const id = scheduleRefresh();
    return () => {
      if (id !== null) window.clearTimeout(id);
    };
  }, [expiresAt, refreshToken, ended, endTime, onEnded]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  if (ended) {
    return null;
  }

  const fullscreenOverlay =
    mounted &&
    isFullscreen &&
    createPortal(
      <div className="fixed inset-0 z-[999999] bg-slate-950 text-white flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4">
          <div className="flex items-center gap-2 font-bold text-lg">
            <QrCodeIcon className="w-6 h-6 text-primary/50" />
            QR Code 簽到
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            aria-label="關閉全螢幕"
          >
            <XMarkIcon className="w-5 h-5" />
            關閉
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 pb-10">
          {error ? (
            <div className="text-center space-y-3">
              <p className="text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void refreshToken();
                }}
                className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-medium"
              >
                重試
              </button>
            </div>
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="簽到 QR Code"
              className="w-[min(78vw,78vh)] h-[min(78vw,78vh)] max-w-[720px] max-h-[720px] rounded-3xl bg-white p-4 shadow-2xl"
            />
          ) : (
            <div className="text-white/70">產生簽到 QR 中…</div>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div className={`rounded-2xl border border-primary/20 bg-primary/10 p-4 ${className}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-primary font-bold">
            <QrCodeIcon className="w-5 h-5" />
            QR Code 簽到
          </div>
          {qrDataUrl && !error && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors"
            >
              <ArrowsPointingOutIcon className="w-4 h-4" />
              全螢幕
            </button>
          )}
        </div>

        {loading && !qrDataUrl ? (
          <div className="h-64 flex items-center justify-center text-sm text-primary">產生簽到 QR 中…</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm p-4 text-center">
            {error}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void refreshToken();
              }}
              className="mt-3 block mx-auto px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-medium"
            >
              重試
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {qrDataUrl && (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="group relative rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="點擊全螢幕顯示"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="簽到 QR Code"
                  className="w-64 h-64 sm:w-72 sm:h-72 rounded-xl bg-white p-2 shadow-sm border border-primary/20"
                />
                <span className="absolute inset-0 rounded-xl bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-primary text-xs font-bold shadow">
                    <ArrowsPointingOutIcon className="w-4 h-4" />
                    全螢幕
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      {fullscreenOverlay}
    </>
  );
}
