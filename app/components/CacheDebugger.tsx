'use client';

import { useState, useEffect } from 'react';
import { getCacheStats, resetCacheStats } from '@/services/authService';
import { CircleStackIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

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
    
    return () => {
        window.removeEventListener('cache-stats', handleCacheStats as EventListener);
    };
  }, []);

  const handleReset = () => {
    resetCacheStats();
    setStats(getCacheStats());
  };

  if (!isVisible || !stats) return null;

  return (
    <div className="fixed top-24 right-4 bg-gray-900/90 text-white p-4 rounded-xl text-xs font-mono z-[9999] max-w-xs shadow-lg backdrop-blur-sm border border-gray-700 transition-opacity hover:opacity-100 opacity-80">
      <div className="mb-3 font-bold text-yellow-400 flex items-center justify-between">
        <div className="flex items-center">
            <CircleStackIcon className="w-4 h-4 mr-2" />
            <span>快取監控</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${stats.hitRate > 50 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
      </div>
      
      <div className="space-y-1.5 text-gray-300">
        <div className="flex justify-between"><span>快取大小:</span> <span className="text-white font-bold">{stats.cacheSize}</span></div>
        <div className="flex justify-between"><span>快取命中:</span> <span className="text-green-400">{stats.cacheHits}</span></div>
        <div className="flex justify-between"><span>快取未命中:</span> <span className="text-red-400">{stats.cacheMisses}</span></div>
        <div className="flex justify-between"><span>總請求:</span> <span className="text-white">{stats.totalRequests}</span></div>
        <div className="flex justify-between pt-2 mt-2 border-t border-gray-700">
            <span>命中率:</span> 
            <span className={`${stats.hitRate > 80 ? 'text-green-400' : stats.hitRate > 50 ? 'text-yellow-400' : 'text-red-400'} font-bold`}>
                {stats.hitRate}%
            </span>
        </div>
      </div>
      
      <button
        onClick={handleReset}
        className="mt-3 w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors flex items-center justify-center border border-gray-600"
      >
        <ArrowPathIcon className="w-3 h-3 mr-1.5" /> 重置統計
      </button>
    </div>
  );
}