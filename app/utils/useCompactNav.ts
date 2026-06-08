import { useState, useEffect } from 'react';

/** 橫向手機常見可視高度上限（px），超過則視為平板/桌機側欄模式 */
export const COMPACT_NAV_HEIGHT_THRESHOLD = 520;

/**
 * 是否使用「手機合併導覽」模式（側欄隱藏、功能選單併入頂部 navbar）。
 * - 直向手機：寬度 < 768px
 * - 橫向手機：觸控裝置且可視高度 ≤ 520px（寬度可能 ≥ 768px）
 */
export function isCompactNavMode(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 768) return true;
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (isTouch && h <= COMPACT_NAV_HEIGHT_THRESHOLD) return true;
  return false;
}

export function useCompactNav(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const update = () => setCompact(isCompactNavMode());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return compact;
}
