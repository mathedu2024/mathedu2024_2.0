'use client';

import { useEffect } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center animate-bounce-in">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <ExclamationTriangleIcon className="w-10 h-10 text-rose-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">發生錯誤</h2>
        
        <p className="text-gray-500 mb-8 leading-relaxed">
          很抱歉，頁面載入時發生了預期外的錯誤。<br />
          請稍後再試，或聯絡管理員。
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            重新載入頁面
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            <HomeIcon className="w-5 h-5 mr-2" />
            返回首頁
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
           <div className="mt-8 p-4 bg-gray-100 rounded-lg text-left overflow-auto max-h-40 text-xs font-mono text-gray-600 border border-gray-200">
             <p className="font-bold mb-1">錯誤詳情 (僅開發模式可見):</p>
             {error.message}
             {error.digest && <div className="mt-1 text-gray-400">Digest: {error.digest}</div>}
           </div>
        )}
      </div>
    </div>
  );
}