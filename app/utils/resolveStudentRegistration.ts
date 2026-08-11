import { adminDb } from '@/services/firebase-admin';
import { findPartnerSchool } from '@/data/partnerSchools';
import { findStudentByAccountOrEmail } from '@/utils/authSessionResponse';
import {
  buildIndustryStudentId,
  buildSchoolStudentId,
  buildVisitorStudentId,
  formatStudentSequence,
  getCurrentRocAcademicYear,
  getEntryYearPrefix,
  isValidCustomAccount,
  isValidSchoolStudentNo,
} from '@/utils/studentRegistration';
import { INDUSTRY_ID_PREFIX } from '@/data/partnerSchools';

export type RegistrantType = 'school' | 'visitor' | 'professional';

export type ResolvedStudentRegistration = {
  studentId: string;
  account: string;
  grade: string;
  schoolGroup: string;
  className: string;
  seatNumber: number | null;
  organization: string;
  jobTitle: string;
  registrationSource: string;
  registrantType: RegistrantType;
};

export async function isStudentIdTaken(studentId: string): Promise<boolean> {
  const byId = await adminDb.collection('student_data').doc(studentId).get();
  if (byId.exists) return true;
  const byField = await adminDb
    .collection('student_data')
    .where('studentId', '==', studentId)
    .limit(1)
    .get();
  if (!byField.empty) return true;
  const byAccount = await adminDb
    .collection('student_data')
    .where('account', '==', studentId)
    .limit(1)
    .get();
  return !byAccount.empty;
}

export async function isAccountTaken(account: string): Promise<boolean> {
  return Boolean(await findStudentByAccountOrEmail(account));
}

/**
 * 依字串前綴掃描已用序號，配置下一個空號。
 * @param idPrefix 完整前綴（訪客：`113`；業界：`I115`）
 * @param buildId 由序號組出完整學號
 */
async function allocateNextId(
  idPrefix: string,
  buildId: (sequence: number) => string
): Promise<string> {
  const used = new Set<number>();
  const re = new RegExp(`^${idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);

  const collect = (raw: string) => {
    const m = re.exec(String(raw || ''));
    if (m) used.add(Number.parseInt(m[1], 10));
  };

  try {
    const snap = await adminDb
      .collection('student_data')
      .where('studentId', '>=', idPrefix)
      .where('studentId', '<', `${idPrefix}\uf8ff`)
      .get();
    snap.docs.forEach((doc) => {
      collect(String(doc.data()?.studentId || ''));
      collect(doc.id);
    });
  } catch {
    const all = await adminDb.collection('student_data').get();
    all.docs.forEach((doc) => {
      collect(String(doc.data()?.studentId || ''));
      collect(doc.id);
    });
  }

  let n = 1;
  while (used.has(n)) n += 1;
  return buildId(n);
}

export async function allocateVisitorStudentId(grade: string): Promise<string> {
  const year = getEntryYearPrefix(grade);
  return allocateNextId(String(year), (n) => buildVisitorStudentId(year, n));
}

export async function allocateIndustryStudentId(now = new Date()): Promise<string> {
  const year = getCurrentRocAcademicYear(now);
  const prefix = `${INDUSTRY_ID_PREFIX}${year}`;
  return allocateNextId(prefix, (n) => buildIndustryStudentId(year, n));
}

function parseRegistrantType(raw: string): RegistrantType {
  const v = String(raw || '').trim();
  if (v === 'school') return 'school';
  if (v === 'professional' || v === 'industry') return 'professional';
  return 'visitor';
}

type ResolveInput = {
  registrantType: string;
  schoolCode?: string;
  schoolStudentNo?: string;
  className?: string;
  seatNumber?: string | number;
  grade?: string;
  customAccount?: string;
  organization?: string;
  jobTitle?: string;
};

/**
 * 依校內／校外在學／業界規則解析學號與帳號。失敗時 throw Error。
 */
export async function resolveStudentRegistration(
  input: ResolveInput
): Promise<ResolvedStudentRegistration> {
  const registrantType = parseRegistrantType(input.registrantType);
  const grade = String(input.grade || '').trim();
  const organization = String(input.organization || '').trim();
  const jobTitle = String(input.jobTitle || '').trim();

  if (registrantType === 'school') {
    const schoolCode = String(input.schoolCode || '').trim().toUpperCase();
    const schoolStudentNo = String(input.schoolStudentNo || '').trim();
    const className = String(input.className || '').trim();
    const seatRaw = String(input.seatNumber ?? '').trim();

    const school = findPartnerSchool(schoolCode);
    if (!school) throw new Error('請選擇合作學校');
    if (!isValidSchoolStudentNo(schoolStudentNo)) {
      throw new Error('學校學號格式不正確（僅英數、底線、連字號）');
    }
    if (!className) throw new Error('請填寫班級');
    if (!seatRaw || Number.isNaN(Number(seatRaw))) throw new Error('請填寫有效座號');
    if (!grade) throw new Error('請選擇年級');

    const studentId = buildSchoolStudentId(school.code, schoolStudentNo);
    if (await isStudentIdTaken(studentId)) {
      throw new Error('此學校學號已註冊，請確認後再試或改用登入');
    }

    return {
      studentId,
      account: studentId,
      grade,
      schoolGroup: school.name,
      className,
      seatNumber: Number(seatRaw),
      organization: '',
      jobTitle: '',
      registrationSource: 'self-school',
      registrantType: 'school',
    };
  }

  const customAccount = String(input.customAccount || '').trim();
  if (!isValidCustomAccount(customAccount)) {
    throw new Error('自訂帳號需為 3～32 碼英數，可含 . _ -');
  }
  if (await isAccountTaken(customAccount)) {
    throw new Error('此帳號已被使用');
  }

  if (registrantType === 'professional') {
    let studentId = await allocateIndustryStudentId();
    if (await isStudentIdTaken(studentId)) {
      studentId = await allocateIndustryStudentId();
    }
    if (await isStudentIdTaken(studentId)) {
      throw new Error('學號配置忙碌中，請稍後再試');
    }

    return {
      studentId,
      account: customAccount,
      grade: '業界',
      schoolGroup: organization || '業界人士',
      className: '',
      seatNumber: null,
      organization,
      jobTitle,
      registrationSource: 'self-professional',
      registrantType: 'professional',
    };
  }

  // 校外在學
  if (!grade) throw new Error('請選擇年級（用於編排學號）');

  let studentId = await allocateVisitorStudentId(grade);
  if (await isStudentIdTaken(studentId)) {
    studentId = await allocateVisitorStudentId(grade);
  }
  if (await isStudentIdTaken(studentId)) {
    throw new Error('學號配置忙碌中，請稍後再試');
  }

  return {
    studentId,
    account: customAccount,
    grade,
    schoolGroup: '',
    className: '',
    seatNumber: null,
    organization: '',
    jobTitle: '',
    registrationSource: 'self-visitor',
    registrantType: 'visitor',
  };
}

/** 僅供預覽：業界學號格式說明 */
export function previewIndustryIdFormat(now = new Date()): string {
  const year = getCurrentRocAcademicYear(now);
  return `${INDUSTRY_ID_PREFIX}${year}${formatStudentSequence(1).replace(/001$/, '***')}`;
}
