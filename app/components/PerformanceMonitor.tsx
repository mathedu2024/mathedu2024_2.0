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
        const memory = (performance as any).memory;
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

    window.addEventListener('login-performance' as any, handleLoginPerformance);
    window.addEventListener('cache-stats' as any, handleCacheStats);
    
    return () => {
      window.removeEventListener('login-performance' as any, handleLoginPerformance);
      window.removeEventListener('cache-stats' as any, handleCacheStats);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="mb-2 font-bold">性能監控</div>
      <div>登入時間: {metrics.loginTime}ms</div>
      <div>快取命中率: {metrics.cacheHitRate}%</div>
      <div>快取命中: {metrics.cacheHits}</div>
      <div>快取未命中: {metrics.cacheMisses}</div>
      <div>總請求: {metrics.totalRequests}</div>
      <div>快取大小: {metrics.cacheSize}</div>
      <div>網路延遲: {metrics.networkLatency}ms</div>
      <div>記憶體使用: {metrics.memoryUsage}MB</div>
    </div>
  );
}

// 性能追蹤工具
export const trackLoginPerformance = (startTime: number, endTime: number, networkLatency: number) => {
  const loginTime = endTime - startTime;
  
  // 發送性能事件
  window.dispatchEvent(new CustomEvent('login-performance', {
    detail: {
      loginTime,
      networkLatency
    }
  }));

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