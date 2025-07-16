'use client';

import { useState, useEffect } from 'react';
import { getCacheStats, resetCacheStats } from '../../services/authService';

interface CacheStats {
  cacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  hitRate: number;
}

export default function CacheDebugger() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 只在開發環境顯示
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    const updateStats = () => {
      const currentStats = getCacheStats();
      setStats(currentStats as CacheStats);
    };

    // 監聽快取統計事件
    const handleCacheStats = () => {
      updateStats();
    };

    window.addEventListener('cache-stats', handleCacheStats as EventListener);
    updateStats(); // 初始載入

    // 暫停自動更新功能
    // const interval = setInterval(updateStats, 2000); // 每2秒更新一次
    // return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    resetCacheStats();
    setStats(getCacheStats());
  };

  if (!isVisible || !stats) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-300 text-yellow-800 p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="mb-2 font-bold">快取調試器</div>
      <div>快取大小: {stats.cacheSize}</div>
      <div>快取命中: {stats.cacheHits}</div>
      <div>快取未命中: {stats.cacheMisses}</div>
      <div>總請求: {stats.totalRequests}</div>
      <div>命中率: {stats.hitRate}%</div>
      <button
        onClick={handleReset}
        className="mt-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
      >
        重置統計
      </button>
    </div>
  );
} 