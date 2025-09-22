'use client';

import { useState } from 'react';

const fqaData = [
  {
    question: '這個網站是做什麼的？',
    answer: '本網站是提供學生與老師使用的學習管理平台，功能包括：課堂資料、成績查詢管理等，目前正在開發輔導預約、線上點名、線上測驗等功能。'
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
    answer: '會的，公告、課程與考試資料皆由老師配合課程更新，課堂資訊。'
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
    answer: '目前沒有即時客服，若有問題可以寄送電子郵件至mathedu2024.class@gmail.com。'
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

export default function FqaPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFqa = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto pb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-center text-blue-600 tracking-tight drop-shadow-sm mb-12">常見問題</h1>
        <div className="space-y-4">
          {fqaData.map((item, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleFqa(index)}
                className="w-full flex justify-between items-center text-left p-6 hover:bg-gray-50 focus:outline-none"
              >
                <span className="text-xl font-semibold text-gray-800">{item.question}</span>
                <svg
                  className={`w-6 h-6 transform transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="p-6 border-t border-gray-200">
                  <p className="text-lg text-gray-700 leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
