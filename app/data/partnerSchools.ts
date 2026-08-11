/** 合作學校（兩位識別碼 + 名稱）。新增合作學校時在此擴充即可。 */
export type PartnerSchool = {
  code: string; // 兩位英數識別碼，大寫
  name: string;
};

export const PARTNER_SCHOOLS: PartnerSchool[] = [
  { code: 'KJ', name: '光仁高中' },
  { code: 'SM', name: '三民高中' },
];

/**
 * 帳號／學號命名空間（方便後台篩選）：
 * - 合作學校：{校碼}{校內學號}，例 KJ12345
 * - 校外在學：{高一入學學年度}{序號}，例 113001
 * - 業界人士：I{註冊學年度}{序號}，例 I115001
 */
export const INDUSTRY_ID_PREFIX = 'I';

export function findPartnerSchool(code: string): PartnerSchool | null {
  const c = String(code || '').trim().toUpperCase();
  return PARTNER_SCHOOLS.find((s) => s.code === c) || null;
}

export const REGISTER_GRADES = [
  '國一',
  '國二',
  '國三',
  '高一',
  '高二',
  '高三',
  '職一',
  '職二',
  '職三',
  '大一',
  '進修',
] as const;

export type RegisterGrade = (typeof REGISTER_GRADES)[number];
