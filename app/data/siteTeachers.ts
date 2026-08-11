/** 網站「老師介紹」頁的公開老師資料（與 /teacher 共用） */

export type SiteTeacher = {
  name: string;
  subject: string;
  photo: string;
  /** 自我介紹（「關於老師」區塊；可換行） */
  introduction?: string;
  education: string[];
  experience: string[];
  expertise: string[];
  /** 授課方向標籤（後備；有對應公開課程時優先顯示真實課程） */
  courses: string[];
};

export const SITE_TEACHERS: SiteTeacher[] = [
  {
    name: '吳其恩 老師',
    subject: '數學科',
    photo: '/老師介紹/吳其恩.png',
    introduction:
      '專注國高中數學教學與計算器教育，協助學生建立清楚觀念與解題直覺，並持續探索數位與智慧教育的應用。',
    education: [
      '新北市 信義國小 (2013/08~2019/06)',
      '新北市 中山國中 (2019/08~2022/06)',
      '光仁高中 普通科 (2022/08~2025/06)',
      '東吳大學 數學系 (2025/09~)',
    ],
    experience: [
      '2018年 亞東技術院 彈指翻轉程式競賽',
      '2019年 北區四城市中小學學生專題寫作比賽',
      '2024年 ARML Local',
      '2024年 TI-Nspire學生數學競賽',
      '2024年 數學競賽校內培訓',
      '2025年 新北市高中計算器檢定',
      '2025年~ 光仁高中數學競賽校內培訓課程助教',
      '2026年~ 三民高中數學競賽校內培訓課程助教',
    ],
    expertise: ['國高中數學成績增強', '高中數學計算器教育', '數位與智慧教育研究'],
    courses: ['國中數學課程', '高中數學課程'],
  },
];


/** 正規化姓名以便比對（去掉空白、「老師」等） */
export function normalizeTeacherName(name: string): string {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/老師/g, '')
    .trim()
    .toLowerCase();
}

export function findSiteTeacherByAuthorName(authorName?: string | null): SiteTeacher | null {
  const key = normalizeTeacherName(authorName || '');
  if (!key) return null;
  return (
    SITE_TEACHERS.find((t) => {
      const tKey = normalizeTeacherName(t.name);
      return tKey === key || tKey.includes(key) || key.includes(tKey);
    }) || null
  );
}

/** 老師介紹頁深連結 */
export function siteTeacherProfileHref(teacher: SiteTeacher): string {
  return `/teacher?name=${encodeURIComponent(normalizeTeacherName(teacher.name))}`;
}
