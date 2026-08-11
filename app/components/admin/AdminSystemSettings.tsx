'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * 系統設定表單殼（SEO／金鑰／公告文字）— 資料持久化後續接 API。
 */
export default function AdminSystemSettings() {
  const [seoTitle, setSeoTitle] = useState('高中學習資源教育網 2.0');
  const [seoDesc, setSeoDesc] = useState('提供高中學習資源與課程資訊的整合平台');
  const [announce, setAnnounce] = useState('');
  const [saved, setSaved] = useState(false);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const field =
    'w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-containerLowest focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-l-4 border-primary pl-4">
        <h2 className="font-display text-2xl font-bold text-on-surface">系統設定</h2>
        <p className="text-sm text-on-surfaceVariant mt-1">分區塊管理全站設定（儲存 API 即將接上）</p>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        <section className="bg-surface-containerLowest rounded-xl border border-outline-variant p-6 space-y-4">
          <h3 className="font-display font-bold text-lg">SEO 設定</h3>
          <div>
            <label className="block text-sm font-semibold mb-1.5">網站標題</label>
            <input className={field} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">網站描述</label>
            <textarea
              className={`${field} min-h-[88px]`}
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
            />
          </div>
        </section>

        <section className="bg-surface-containerLowest rounded-xl border border-outline-variant p-6 space-y-4">
          <h3 className="font-display font-bold text-lg">API 金鑰</h3>
          <p className="text-sm text-on-surfaceVariant">
            實際金鑰請於伺服器環境變數設定（Firebase、EmailJS 等），此處僅顯示說明。
          </p>
          <div className="font-mono text-xs bg-surface-containerLow rounded-lg p-4 text-on-surfaceVariant">
            NEXT_PUBLIC_FIREBASE_* · EMAILJS_PRIVATE_KEY · …
          </div>
        </section>

        <section className="bg-surface-containerLowest rounded-xl border border-outline-variant p-6 space-y-4">
          <h3 className="font-display font-bold text-lg">全站公告文字</h3>
          <textarea
            className={`${field} min-h-[100px]`}
            placeholder="顯示於維護通知或首頁橫幅的預設文案…"
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
          />
          <Link href="/back-panel/announcements" className="text-sm text-primary font-semibold hover:underline">
            或前往公告管理發布正式公告 →
          </Link>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary transition-colors"
          >
            儲存設定
          </button>
          {saved ? <span className="text-sm text-secondary font-medium">已暫存於本機（示意）</span> : null}
        </div>
      </form>
    </div>
  );
}
