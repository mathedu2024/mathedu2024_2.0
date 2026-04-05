'use client';

import React from 'react';
import Script from 'next/script';

export default function UISample() {
  const showSuccessAlert = () => {
    // @ts-expect-error: Swal is loaded via script tag
    if (typeof Swal !== 'undefined') {
      // @ts-expect-error: Swal is loaded via script tag
      Swal.fire({
        icon: 'success',
        title: '建立成功！',
        text: '您的資源資料夾已準備就緒。',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: '太棒了',
        customClass: {
          popup: 'rounded-2xl',
        }
      });
    }
  };

  const showConfirmAlert = () => {
    // @ts-expect-error: Swal is loaded via script tag
    if (typeof Swal !== 'undefined') {
      // @ts-expect-error: Swal is loaded via script tag
      Swal.fire({
        title: '確定要刪除資源？',
        text: "刪除後無法復原，請確認。",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '是的，刪除',
        cancelButtonText: '取消',
        customClass: {
          popup: 'rounded-2xl',
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans p-8 pb-20">
      
      {/* Scripts */}
      <Script src="https://cdn.tailwindcss.com" />
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" />

      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">UI Design System</h1>
            <p className="text-gray-500">基於 Tailwind CSS 的現代化教學平台元件庫</p>
        </div>

        {/* 1. 色彩系統 (Color Palette) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">1. 核心配色 (Color Palette)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-indigo-600 shadow-lg flex items-center justify-center text-white font-mono">bg-indigo-600</div>
                    <p className="text-center font-bold text-gray-700">主色調 (Primary)</p>
                    <p className="text-center text-xs text-gray-500">按鈕、重點標題、Icon背景</p>
                </div>
                <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-emerald-500 shadow-lg flex items-center justify-center text-white font-mono">bg-emerald-500</div>
                    <p className="text-center font-bold text-gray-700">次要色 (Secondary)</p>
                    <p className="text-center text-xs text-gray-500">學生端、成功訊息、強調</p>
                </div>
                <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 font-mono">bg-gray-50</div>
                    <p className="text-center font-bold text-gray-700">背景色 (Background)</p>
                    <p className="text-center text-xs text-gray-500">網頁底色、區塊分隔</p>
                </div>
                <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 font-mono">bg-white</div>
                    <p className="text-center font-bold text-gray-700">卡片色 (Surface)</p>
                    <p className="text-center text-xs text-gray-500">內容卡片、彈窗背景</p>
                </div>
            </div>
        </div>

        {/* 2. 按鈕 (Buttons) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">2. 按鈕樣式 (Buttons)</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                
                {/* Primary Button */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Primary Action</span>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm hover:shadow-md transition-all">
                        <i className="fas fa-plus mr-2"></i>建立資料夾
                    </button>
                </div>

                {/* Secondary Button */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Secondary Action</span>
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm hover:shadow-md transition-all">
                        <i className="fas fa-search mr-2"></i>搜尋資源
                    </button>
                </div>

                {/* Outline/Ghost Button */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Ghost / Link</span>
                    <button className="text-indigo-600 hover:text-indigo-800 font-medium py-2 px-4 rounded-lg hover:bg-indigo-50 transition-colors">
                        查看詳情 <i className="fas fa-arrow-right ml-1"></i>
                    </button>
                </div>

                {/* Icon Button */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Icon Only</span>
                    <button className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors flex items-center justify-center">
                        <i className="fas fa-trash"></i>
                    </button>
                </div>

                {/* AI Gradient Button */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Special / AI</span>
                    <button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all font-bold">
                        <i className="fas fa-sparkles mr-2 animate-pulse"></i> AI 助手
                    </button>
                </div>
            </div>
        </div>

        {/* 3. 表單元件 (Forms) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">3. 表單元件 (Inputs & Forms)</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Input Field */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Text Input</span>
                    <label className="text-gray-700 text-sm font-bold mb-2 block">資料夾名稱</label>
                    <input type="text" placeholder="例如：數學第一章" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow" />
                </div>

                {/* Select Dropdown */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Select Dropdown</span>
                    <label className="text-gray-700 text-sm font-bold mb-2 block">資源類型</label>
                    <div className="relative">
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                            <option>📺 YouTube 影片</option>
                            <option>📄 PDF 文件</option>
                            <option>🔗 外部連結</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <i className="fas fa-chevron-down text-xs"></i>
                        </div>
                    </div>
                </div>

                {/* Input Group (Search) */}
                <div className="md:col-span-2">
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Search Input Group</span>
                    <div className="flex shadow-sm rounded-lg overflow-hidden border border-gray-300 max-w-md focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-emerald-400">
                        <input type="text" placeholder="輸入 6 位索引碼..." className="flex-1 px-4 py-2 text-gray-700 focus:outline-none" />
                        <button className="bg-emerald-500 text-white px-6 py-2 hover:bg-emerald-600 font-medium transition-colors">
                            前往
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* 4. 卡片與列表 (Cards & Lists) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">4. 卡片設計 (Cards)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Dashboard Card */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Dashboard Folder Card</span>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative cursor-pointer group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <i className="fas fa-folder fa-lg"></i>
                            </div>
                            <span className="text-xs font-mono px-2 py-1 bg-gray-100 rounded text-gray-600">
                                <i className="fas fa-key mr-1"></i>A3J9QX
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg mb-1">一次函數教學影片</h3>
                        <div className="flex items-center justify-between mt-4">
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">公開資源</span>
                            <span className="text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
                                進入 <i className="fas fa-arrow-right ml-1"></i>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Resource List Item */}
                <div>
                    <span className="text-xs font-mono text-gray-400 mb-2 block">Resource List Item</span>
                    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                        <div className="flex items-center overflow-hidden">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mr-4 flex-shrink-0 text-red-500">
                                <i className="fas fa-file-pdf fa-lg"></i>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-800">期末考複習講義.pdf</h4>
                                <span className="text-xs text-gray-400">2023-12-31 上傳</span>
                            </div>
                        </div>
                        <button className="text-gray-400 hover:text-indigo-600 p-2">
                            <i className="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* 5. 表格 (Table) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">5. 表格設計 (Data Table)</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">資源名稱</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類型</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {/* Row 1 */}
                        <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3">
                                        <i className="fas fa-file"></i>
                                    </div>
                                    <span className="font-medium text-gray-900">微積分第一章</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">PDF 文件</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    公開
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <a href="#" className="text-indigo-600 hover:text-indigo-900">編輯</a>
                            </td>
                        </tr>
                        {/* Row 2 */}
                        <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 rounded bg-red-100 text-red-600 flex items-center justify-center mr-3">
                                        <i className="fas fa-video"></i>
                                    </div>
                                    <span className="font-medium text-gray-900">教學影片 Part 2</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">YouTube</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    私有
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <a href="#" className="text-indigo-600 hover:text-indigo-900">編輯</a>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* 6. SweetAlert2 設定 (Popups) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">6. SweetAlert2 整合 (Popups)</h2>
            <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <p className="text-gray-600 mb-4">
                    為了讓 SweetAlert2 的風格與 Tailwind UI 一致，我們需要設定 `confirmButtonColor` 並調整圓角。
                    點擊下方按鈕測試效果。
                </p>
                <div className="flex gap-4">
                    <button onClick={showSuccessAlert} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">
                        測試成功訊息
                    </button>
                    <button onClick={showConfirmAlert} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">
                        測試確認視窗
                    </button>
                </div>

                {/* Code Block for SweetAlert2 */}
                <div className="mt-6 bg-gray-800 rounded-lg p-4 overflow-x-auto">
<pre className="text-xs text-green-400 font-mono">
{`// 1. 成功訊息 (Success Toast)
Swal.fire({
    icon: 'success',
    title: '操作成功！',
    text: '資料夾已建立完成',
    confirmButtonColor: '#4f46e5', // Tailwind Indigo-600
    confirmButtonText: '好的',
    customClass: {
        popup: 'rounded-2xl', // 圓角視窗
        confirmButton: 'px-6 py-2 rounded-lg font-bold'
    }
});

// 2. 危險操作確認 (Delete Confirmation)
Swal.fire({
    title: '確定要刪除嗎？',
    text: "此動作無法復原！",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // Tailwind Red-500
    cancelButtonColor: '#9ca3af', // Tailwind Gray-400
    confirmButtonText: '是的，刪除',
    cancelButtonText: '取消',
    customClass: {
        popup: 'rounded-2xl'
    }
});`}
</pre>
                </div>
            </div>
        </div>

        {/* 7. 自定義模態視窗 (Custom Modal) */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-500 pl-4">7. 自定義模態視窗 (AI Modal Style)</h2>
            <div className="relative bg-gray-200 h-64 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-400">
                <span className="text-gray-500">背景模擬區</span>
                
                {/* The Modal HTML Structure */}
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center"><i className="fas fa-robot mr-2"></i> AI 助手</h3>
                            <button className="text-white/80 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        {/* Content */}
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i className="fas fa-sparkles"></i>
                            </div>
                            <p className="text-gray-600 text-sm">請選擇您想要的功能，AI 將為您自動生成。</p>
                        </div>
                        {/* Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                            <button className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">取消</button>
                            <button className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">開始生成</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}