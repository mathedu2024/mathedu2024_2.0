'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CameraIcon, ExclamationTriangleIcon, QrCodeIcon } from '@heroicons/react/24/outline';

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'secure_required';

interface AttendanceQrScannerProps {
  onToken: (token: string, meta?: { courseId?: string; activityId?: string }) => void;
  disabled?: boolean;
}

function parseAttendanceQr(raw: string): { token?: string; courseId?: string; activityId?: string } | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    const url = new URL(text, typeof window !== 'undefined' ? window.location.origin : 'https://local');
    const token = url.searchParams.get('token') || undefined;
    const courseId = url.searchParams.get('courseId') || undefined;
    const activityId = url.searchParams.get('activity') || url.searchParams.get('activityId') || undefined;
    if (token) return { token, courseId, activityId };
  } catch {
    // not a URL
  }

  // 純 token（後備）
  if (/^[a-f0-9]{16,64}$/i.test(text)) {
    return { token: text };
  }
  return null;
}

export default function AttendanceQrScanner({ onToken, disabled }: AttendanceQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<PermissionState>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const handledRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    if (disabled) return;
    handledRef.current = false;
    setErrorDetail(null);

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setPermission('secure_required');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return;
    }

    setPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPermission('granted');
      setScanning(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermission('denied');
        setErrorDetail('瀏覽器拒絕相機權限。請到系統設定開啟相機，或改用手機內建相機掃碼。');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermission('unsupported');
        setErrorDetail('找不到可用相機。請改用手機內建相機掃描老師出示的 QR。');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPermission('denied');
        setErrorDetail('相機正被其他應用程式占用，請關閉後重試，或改用系統相機掃碼。');
      } else {
        setPermission('denied');
        setErrorDetail(err instanceof Error ? err.message : '無法開啟相機');
      }
    }
  }, [disabled]);

  useEffect(() => {
    if (!scanning || permission !== 'granted' || disabled) return;

    const BarcodeDetectorCtor = (window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setPermission('unsupported');
      setErrorDetail('此瀏覽器不支援網頁掃碼。請用手機「相機」App 掃描 QR，會自動開啟簽到頁。');
      stopCamera();
      return;
    }

    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
    let cancelled = false;
    let raf = 0;

    const loop = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && !handledRef.current) {
          const parsed = parseAttendanceQr(codes[0].rawValue);
          if (parsed?.token) {
            handledRef.current = true;
            stopCamera();
            onToken(parsed.token, { courseId: parsed.courseId, activityId: parsed.activityId });
            return;
          }
        }
      } catch {
        // ignore frame errors
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [scanning, permission, disabled, onToken, stopCamera]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <label className="block text-sm font-medium text-gray-600 mb-2">掃描簽到 QR Code</label>
        <p className="text-xs text-gray-500 mb-3">
          建議直接用手機內建相機掃描（免開瀏覽器權限）。也可在此頁開啟相機掃碼。
        </p>
      </div>

      {permission === 'granted' ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[420px]">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 border-[3px] border-white/40 m-10 rounded-2xl pointer-events-none" />
          <button
            type="button"
            onClick={stopCamera}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm"
          >
            關閉相機
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-center space-y-3">
          <QrCodeIcon className="w-10 h-10 text-indigo-400 mx-auto" />

          {(permission === 'denied' || permission === 'unsupported' || permission === 'secure_required') && (
            <div className="flex items-start gap-2 text-left text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                {permission === 'secure_required' && (
                  <p>相機掃碼需要安全連線（HTTPS）。請改用手機相機掃描老師的 QR，或改用 HTTPS 網址開啟本頁。</p>
                )}
                {permission === 'denied' && <p>{errorDetail || '未取得相機權限。'}</p>}
                {permission === 'unsupported' && (
                  <p>{errorDetail || '此裝置／瀏覽器無法在網頁內掃碼。'}</p>
                )}
                <ol className="mt-2 list-decimal list-inside text-xs text-amber-900/80 space-y-1">
                  <li>打開手機內建「相機」</li>
                  <li>對準老師螢幕上的簽到 QR</li>
                  <li>點擊提示連結，登入後即可自動簽到</li>
                </ol>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={disabled || permission === 'requesting'}
            onClick={() => void startCamera()}
            className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            <CameraIcon className="w-5 h-5" />
            {permission === 'requesting' ? '請求相機權限…' : '開啟相機掃碼'}
          </button>
        </div>
      )}
    </div>
  );
}
