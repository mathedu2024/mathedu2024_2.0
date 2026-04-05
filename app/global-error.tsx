'use client';

import { useEffect } from 'react';
// Note: global-error.tsx 必須包含 <html> 和 <body> 標籤
// 因為它會替換掉 root layout

export default function GlobalError({
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
    <html lang="zh-TW">
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-10 text-center">
            
            {/* Icon */}
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               {/* Heroicon: ExclamationCircle (Inline SVG for global error to avoid dependency issues) */}
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </div>
            
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">系統發生嚴重錯誤</h2>
            
            <p className="text-gray-500 mb-8 text-lg leading-relaxed">
              很抱歉，系統遇到無法恢復的錯誤。<br />
              我們建議您重新整理頁面。
            </p>
            
            <div className="space-y-4">
              <button
                onClick={reset}
                className="w-full flex items-center justify-center px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                重新載入頁面
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                返回首頁
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-8 text-left">
                    <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Error Details:</div>
                    <pre className="p-4 bg-red-50 rounded-lg text-xs font-mono text-red-700 overflow-auto max-h-40 border border-red-100">
                        {error.message}
                        {error.digest && `\nDigest: ${error.digest}`}
                    </pre>
                </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}