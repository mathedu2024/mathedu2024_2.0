'use client';

import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 記錄錯誤到控制台以利後續追蹤
    console.error('捕捉到未處理錯誤:', error);

    // 使用 SweetAlert2 顯示提示
    Swal.fire({
      title: '系統發生錯誤',
      text: '很抱歉，頁面載入時發生了預期外的錯誤。',
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: '重新整理頁面',
      cancelButtonText: '返回首頁',
      confirmButtonColor: '#4f46e5', // indigo-600
      cancelButtonColor: '#9ca3af', // gray-400
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        popup: 'rounded-2xl',
        title: 'text-xl font-bold text-gray-900',
        confirmButton: 'px-6 py-2.5 rounded-xl font-bold transition-all',
        cancelButton: 'px-6 py-2.5 rounded-xl font-bold transition-all'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        reset(); // 嘗試恢復元件
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        window.location.href = '/'; // 跳轉至首頁
      }
    });
  }, [error, reset]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 text-sm font-medium">正在處理異常訊息...</p>
      </div>
    </div>
  );
}