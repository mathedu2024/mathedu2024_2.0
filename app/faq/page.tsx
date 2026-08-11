'use client';

import { useMemo, useState } from 'react';
import SiteFooter from '@/components/site/SiteFooter';
import Swal from '@/utils/swalTheme';

type FaqItem = { question: string; answer: string };
type FaqCategory = {
  id: string;
  title: string;
  icon: string;
  iconWrapClass: string;
  items: FaqItem[];
};

const CONTACT_EMAIL = 'mathedu2024.class@gmail.com';

const faqCategories: FaqCategory[] = [
  {
    id: 'about',
    title: '關於本站',
    icon: 'fa-circle-info',
    iconWrapClass: 'bg-primary-container text-on-primary',
    items: [
      {
        question: '這個網站是做什麼的？',
        answer:
          '本網站是提供學生與老師使用的學習管理平台，功能包括：課堂資料、成績查詢管理、輔導預約、線上點名、線上資源、線上測驗、線上文章等。',
      },
      {
        question: '我不是學生／老師，可以使用這個網站嗎？',
        answer: '目前僅開放給已註冊的學生與授課老師使用，訪客無法登入或參與課程。公開頁面仍可瀏覽課程介紹、線上文章與常見問題。',
      },
      {
        question: '這個網站是公立學校使用的嗎？',
        answer: '這個網站目前不屬於任何學校，由吳其恩老師負責管理及規劃。',
      },
      {
        question: '是否需要付費才能使用？',
        answer: '目前正在進行系統耐力測試，未來將開放部分課程付費線上學習。',
      },
      {
        question: '這個網站是否支援英文介面？',
        answer: '目前網站主要以中文為主，若需語言支援可以透過瀏覽器內建的網頁翻譯功能。',
      },
    ],
  },
  {
    id: 'account',
    title: '帳號使用',
    icon: 'fa-user',
    iconWrapClass: 'bg-secondary-container text-secondary',
    items: [
      {
        question: '如果我沒有帳號可以註冊嗎？',
        answer: '可以。請到登入頁點選「立即註冊」，或以 Google 帳號登入；系統會為您建立學生帳號。老師／管理員帳號仍需由管理員邀請開通。',
      },
      {
        question: '我該從哪裡開始使用這個網站？',
        answer: '若你已有帳號，請從首頁「登入」開始進行。',
      },
      {
        question: '忘記密碼怎麼辦？',
        answer:
          '請到登入頁點選「忘記密碼」，輸入註冊信箱後依信件指示重設密碼。若未收到信件，請檢查垃圾郵件匣，或聯絡管理員協助。',
      },
      {
        question: '這個網站可以查詢什麼資料？',
        answer: '登入後可查詢成績、補課影片、線上資源、回家作業等教學資訊。',
      },
    ],
  },
  {
    id: 'learning',
    title: '課程與學習',
    icon: 'fa-graduation-cap',
    iconWrapClass: 'bg-tertiary-container text-white',
    items: [
      {
        question: '網站是否提供線上教學影片或課程資料？',
        answer: '是的，老師可上傳課程教材與補課影片，學生登入後可依所報名的課程進行瀏覽。',
      },
      {
        question: '我可以觀看網站的課程影片或資料嗎？',
        answer: '非登入使用者無法觀看課程影片或下載資料，僅限已報名課程的學生。',
      },
      {
        question: '這個網站的資訊會定期更新嗎？',
        answer: '會的，公告、課程與考試資料皆由老師配合課程更新，確保資訊即時。',
      },
    ],
  },
  {
    id: 'support',
    title: '技術與支援',
    icon: 'fa-headset',
    iconWrapClass: 'bg-surface-containerHighest text-primary',
    items: [
      {
        question: '我可以透過手機或平板使用這個網站嗎？',
        answer: '可以，網站支援行動裝置瀏覽，建議使用 Chrome、Safari 或 Edge 等現代瀏覽器。',
      },
      {
        question: '影片無法播放或頁面異常怎麼辦？',
        answer:
          '請先確認網路連線穩定，並嘗試清除瀏覽器快取或改用其他瀏覽器。若問題持續，請聯絡管理員並說明使用裝置與瀏覽器版本。',
      },
      {
        question: '我進入網站後看到的是空白頁，怎麼辦？',
        answer: '請確認你是否使用支援的瀏覽器並已登入正確帳號，若問題持續請聯絡管理員。',
      },
      {
        question: '網站每天都可以使用嗎？有維護時間嗎？',
        answer: '網站全年無休，但如遇系統更新或維護會提前公告暫停使用時間。',
      },
      {
        question: '網站有提供即時聯絡窗口嗎？',
        answer: `目前沒有即時客服，若有問題可以寄送電子郵件至 ${CONTACT_EMAIL}。`,
      },
    ],
  },
];

function itemKey(categoryId: string, index: number) {
  return `${categoryId}-${index}`;
}

export default function FaqPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqCategories;
    return faqCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search]);

  const toggleFaq = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const handleContact = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      await Swal.fire({
        title: '信箱已複製',
        text: `已複製 ${CONTACT_EMAIL}，歡迎來信聯繫。`,
        icon: 'success',
        confirmButtonText: '確定',
      });
    } catch {
      await Swal.fire({
        title: '請手動複製信箱',
        text: CONTACT_EMAIL,
        icon: 'info',
        confirmButtonText: '確定',
      });
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      <main className="page-shell flex-grow py-10 md:py-12 flex flex-col items-center">
        <div className="w-full max-w-3xl text-center mb-10 md:mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-on-surface mb-4 tracking-tight">
            有什麼我們可以幫忙的嗎？
          </h1>
          <p className="text-lg text-on-surfaceVariant mb-8 leading-relaxed">
            搜尋常見問題，或依下方分類瀏覽。
          </p>
          <div className="relative w-full max-w-2xl mx-auto shadow-sm">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-on-surfaceVariant" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋問題…（例如：忘記密碼）"
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-outline-variant bg-surface-containerLowest focus:border-primary focus:ring-2 focus:ring-primary-fixed outline-none transition-all text-base md:text-lg text-on-surface placeholder:text-on-surfaceVariant/50"
            />
          </div>
        </div>

        <div className="w-full max-w-3xl grid grid-cols-1 gap-8">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-16 bg-surface-containerLowest rounded-xl border border-dashed border-outline-variant">
              <h3 className="text-lg font-medium text-on-surface mb-1">沒有找到相關問題</h3>
              <p className="text-on-surfaceVariant text-sm">請嘗試其他關鍵字，或直接聯絡我們。</p>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <section key={category.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${category.iconWrapClass}`}
                  >
                    <i className={`fas ${category.icon}`} aria-hidden />
                  </div>
                  <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">
                    {category.title}
                  </h2>
                </div>

                <div className="flex flex-col gap-4">
                  {category.items.map((item, index) => {
                    const key = itemKey(category.id, index);
                    const isOpen = openKey === key;
                    return (
                      <div
                        key={key}
                        className={`bg-surface-containerLowest rounded-xl border border-outline-variant overflow-hidden transition-shadow ${
                          isOpen ? 'shadow-elevate' : 'hover:shadow-elevate'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-5 md:px-6 py-4 flex justify-between items-center gap-4 focus:outline-none"
                          onClick={() => toggleFaq(key)}
                          aria-expanded={isOpen}
                        >
                          <span className="text-base md:text-lg font-bold text-on-surface">
                            {item.question}
                          </span>
                          <i
                            className={`fas fa-chevron-down text-on-surfaceVariant shrink-0 transition-transform duration-300 ${
                              isOpen ? 'rotate-180 text-primary' : ''
                            }`}
                            aria-hidden
                          />
                        </button>
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="px-5 md:px-6 bg-surface-containerLow border-t border-outline-variant/30">
                              <p className="py-4 text-on-surfaceVariant leading-relaxed text-sm md:text-base">
                                {item.answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="w-full max-w-3xl mt-14 md:mt-16 p-8 bg-surface-containerHigh rounded-2xl flex flex-col items-center text-center">
          <i className="fas fa-headset text-4xl text-primary mb-4" aria-hidden />
          <h3 className="font-display text-xl md:text-2xl font-bold text-on-surface mb-2">
            找不到答案嗎？
          </h3>
          <p className="text-on-surfaceVariant mb-6">歡迎來信，我們會盡快協助您。</p>
          <button
            type="button"
            onClick={() => void handleContact()}
            className="bg-primary-container text-on-primary font-bold px-8 py-3 rounded-full hover:bg-primary transition-colors inline-flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            <i className="fas fa-envelope text-sm" aria-hidden />
            聯絡我們
          </button>
          <p className="mt-3 text-xs text-on-surfaceVariant">{CONTACT_EMAIL}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
