/** 台灣五標百分位計算（與成績管理相同算法） */
export interface FiveMarkStatistics {
  平均: number | null;
  頂標: number | null;
  前標: number | null;
  均標: number | null;
  後標: number | null;
  底標: number | null;
}

export function getTaiwanPercentileLevels(scores: number[]): FiveMarkStatistics {
  if (!scores || scores.length === 0) {
    return { 平均: null, 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null };
  }
  const sorted = [...scores].sort((a, b) => b - a);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return {
    平均: avg,
    頂標: sorted[Math.floor(scores.length * 0.12)] ?? null,
    前標: sorted[Math.floor(scores.length * 0.25)] ?? null,
    均標: sorted[Math.floor(scores.length * 0.5)] ?? null,
    後標: sorted[Math.floor(scores.length * 0.75)] ?? null,
    底標: sorted[Math.floor(scores.length * 0.88)] ?? null,
  };
}

export const FIVE_MARK_LABELS = ['頂標', '前標', '均標', '後標', '底標', '平均'] as const;
