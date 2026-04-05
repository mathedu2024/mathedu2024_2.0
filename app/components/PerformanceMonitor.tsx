'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loginTime: number;
  cacheHitRate: number;
  networkLatency: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  cacheSize: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loginTime: 0,
    cacheHitRate: 0,
    networkLatency: 0,
    memoryUsage: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    cacheSize: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 只在開發環境顯示
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true);
    }

    const updateMetrics = () => {
      if (typeof window !== 'undefined' && 'performance' in window) {
        // Performance.memory is a non-standard Chrome extension
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0
        }));
      }
    };

    updateMetrics();
    // 暫停自動更新功能
    // const interval = setInterval(updateMetrics, 5000);
    // return () => clearInterval(interval);
  }, []);

  // 監聽登入性能
  useEffect(() => {
    const handleLoginPerformance = (event: CustomEvent) => {
      setMetrics(prev => ({
        ...prev,
        loginTime: event.detail.loginTime,
        networkLatency: event.detail.networkLatency
      }));
    };

    const handleCacheStats = (event: CustomEvent) => {
      setMetrics(prev => ({
        ...prev,
        cacheHitRate: event.detail.hitRate,
        cacheHits: event.detail.cacheHits,
        cacheMisses: event.detail.cacheMisses,
        totalRequests: event.detail.totalRequests,
        cacheSize: event.detail.cacheSize
      }));
    };

    window.addEventListener('login-performance', handleLoginPerformance as EventListener);
    window.addEventListener('cache-stats', handleCacheStats as EventListener);
    
    return () => {
      window.removeEventListener('login-performance', handleLoginPerformance as EventListener);
      window.removeEventListener('cache-stats', handleCacheStats as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/90 text-white p-4 rounded-xl text-xs font-mono z-[9999] max-w-xs shadow-lg backdrop-blur-sm border border-gray-700">
      <div className="mb-3 font-bold text-indigo-400 flex items-center justify-between">
        <span>性能監控</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between"><span>登入時間:</span> <span className="text-gray-300">{metrics.loginTime}ms</span></div>
        <div className="flex justify-between"><span>快取命中率:</span> <span className={`${metrics.cacheHitRate > 80 ? 'text-green-400' : 'text-yellow-400'}`}>{metrics.cacheHitRate}%</span></div>
        <div className="flex justify-between"><span>快取命中:</span> <span className="text-gray-300">{metrics.cacheHits}</span></div>
        <div className="flex justify-between"><span>快取未命中:</span> <span className="text-gray-300">{metrics.cacheMisses}</span></div>
        <div className="flex justify-between"><span>總請求:</span> <span className="text-gray-300">{metrics.totalRequests}</span></div>
        <div className="flex justify-between"><span>快取大小:</span> <span className="text-gray-300">{metrics.cacheSize}</span></div>
        <div className="flex justify-between"><span>網路延遲:</span> <span className="text-gray-300">{metrics.networkLatency}ms</span></div>
        <div className="flex justify-between"><span>記憶體使用:</span> <span className="text-gray-300">{metrics.memoryUsage}MB</span></div>
      </div>
    </div>
  );
}

// 性能追蹤工具
export const trackLoginPerformance = (startTime: number, endTime: number, networkLatency: number) => {
  const loginTime = endTime - startTime;
  
  // 發送性能事件
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('login-performance', {
      detail: {
        loginTime,
        networkLatency
      }
    }));
  }

  // 記錄到控制台
  console.log(`登入性能: ${loginTime}ms, 網路延遲: ${networkLatency}ms`);
  
  // 如果登入時間超過閾值，記錄警告
  if (loginTime > 2000) {
    console.warn(`登入時間過長: ${loginTime}ms`);
  }
};

export const trackCacheHit = (hit: boolean) => {
  // 這裡可以實現更複雜的快取統計
  console.log(`快取${hit ? '命中' : '未命中'}`);
};