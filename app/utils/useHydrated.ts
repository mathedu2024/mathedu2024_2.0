'use client';

import { useLayoutEffect, useState } from 'react';

/** SSR 與 hydration 首屏皆為 false，掛載後才 true，用於避免 session 資料造成 hydration 文字不一致 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useLayoutEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
