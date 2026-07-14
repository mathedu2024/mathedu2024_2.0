import { useEffect, useState } from 'react';

/** 學生測驗／作答紀錄：小於 lg (1024px) 使用手機版一題一頁版面 */
export const MOBILE_EXAM_LAYOUT_QUERY = '(max-width: 1023px)';

export function isMobileExamLayout(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_EXAM_LAYOUT_QUERY).matches;
}

export function useMobileExamLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_EXAM_LAYOUT_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return mobile;
}
