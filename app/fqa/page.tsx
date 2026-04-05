'use client';

import { useState } from 'react';

const faqData = [
  {
    question: '這個網站是做什麼的？',
    answer: '本網站是提供學生與老師使用的學習管理平台，功能包括：課堂資料、成績查詢管理、輔導預約、線上點名、等，目前正在開發線上測驗、線上文章、線上資料等功能。'
  },
  {
    question: '我不是學生／老師，可以使用這個網站嗎？',
    answer: '目前僅開放給已註冊的學生與授課老師使用，訪客無法登入或參與課程。'
  },
  {
    question: '這個網站是公立學校使用的嗎？',
    answer: '這個網站目前不屬於任何學校，由吳其恩老師負責管理及規劃。'
  },
  {
    question: '是否需要付費才能使用？',
    answer: '目前正在進行耐力測試，未來將開放部分課程付費線上學習。'
  },
  {
    question: '網站是否提供線上教學影片或課程資料？',
    answer: '是的，老師可上傳課程教材與補課影片，學生登入後可依所報名的課程進行瀏覽。'
  },
  {
    question: '我可以透過手機或平板使用這個網站嗎？',
    answer: '可以，網站支援行動裝置瀏覽，建議使用 Chrome、Safari 或 Edge 等現代瀏覽器。'
  },
  {
    question: '如果我沒有帳號可以註冊嗎？',
    answer: '目前不開放自由註冊，帳號需由管理員建立。'
  },
  {
    question: '我該從哪裡開始使用這個網站？',
    answer: '若你已有帳號，請從首頁「登入課程」開始進行。'
  },
  {
    question: '這個網站可以查詢什麼資料？',
    answer: '登入後可查詢成績、補課影片、課堂公告等教學資訊。'
  },
  {
    question: '這個網站的資訊會定期更新嗎？',
    answer: '會的，公告、課程與考試資料皆由老師配合課程更新，確保資訊即時。'
  },
  {
    question: '我可以觀看網站的課程影片或資料嗎？',
    answer: '非登入使用者無法觀看課程影片或下載資料，僅限已報名課程的學生。'
  },
  {
    question: '這個網站是否支援英文介面？',
    answer: '目前網站主要以中文為主，若需語言支援可與管理員反應需求。'
  },
  {
    question: '網站有提供即時聯絡窗口嗎？',
    answer: '目前沒有即時客服，若有問題可以寄送電子郵件至 mathedu2024.class@gmail.com。'
  },
  {
    question: '我進入網站後看到的是空白頁，怎麼辦？',
    answer: '請確認你是否使用支援的瀏覽器並已登入正確帳號，若問題持續請聯絡管理員。'
  },
  {
    question: '網站每天都可以使用嗎？有維護時間嗎？',
    answer: '網站全年無休，但如遇系統更新或維護會提前公告暫停使用時間。'
  }
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        
        {/* 頁面標題 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            常見問題
          </h1>
          <p className="text-gray-500 text-lg">
            在這裡您可以找到關於平台使用的各種解答
          </p>
        </div>

        {/* FAQ 列表 */}
        <div className="space-y-4">
          {faqData.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen 
                    ? 'border-indigo-200 shadow-md ring-1 ring-indigo-100' 
                    : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
                }`}
              >
                <button
                  className="w-full text-left p-5 md:p-6 flex items-center justify-between group focus:outline-none"
                  onClick={() => toggleFaq(index)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                    }`}>
                      <span className="font-bold text-sm">Q</span>
                    </div>
                    <span className={`text-lg font-bold transition-colors ${
                      isOpen ? 'text-indigo-700' : 'text-gray-800 group-hover:text-indigo-600'
                    }`}>
                      {item.question}
                    </span>
                  </div>
                  
                  <div className={`w-6 h-6 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                <div
                  className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 pt-0 pl-[4.5rem]"> {/* Indent answer to align with question text */}
                    <div className="text-gray-600 leading-relaxed border-l-2 border-indigo-100 pl-4 py-1">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部聯絡資訊 */}
        <div className="mt-12 text-center bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-2">找不到您要的答案嗎？</h3>
          <p className="text-gray-500 mb-4">歡迎直接與我們聯繫，我們將盡快為您服務。</p>
          <a 
            href="mailto:mathedu2024.class@gmail.com" 
            className="inline-flex items-center text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
          >
            <i className="fas fa-envelope mr-2"></i>
            mathedu2024.class@gmail.com
          </a>
        </div>

      </div>
    </div>
  );
}