import type { RegisterGrade } from '@/data/partnerSchools';
import { INDUSTRY_ID_PREFIX } from '@/data/partnerSchools';

/**
 * 台灣學年度（民國年）。
 * 8/1 起為新學年：例如 2025-08-01～2026-07-31 → 114 學年度。
 */
export function getCurrentRocAcademicYear(now = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const roc = y - 1911;
  // 1～7 月仍屬前一學年度
  return m >= 8 ? roc : roc - 1;
}

/**
 * 由目前年級推算「高一入學學年度」（民國年）。
 * 例：現在是 114 學年度的高二 → 高一為 113。
 * 國中以國一為基準；大一視為已過三年高中。
 */
export function getEntryYearPrefix(grade: string, now = new Date()): number {
  const current = getCurrentRocAcademicYear(now);
  const offsetByGrade: Record<string, number> = {
    國一: 0,
    國二: 1,
    國三: 2,
    高一: 0,
    高二: 1,
    高三: 2,
    職一: 0,
    職二: 1,
    職三: 2,
    大一: 3,
    進修: 0,
  };
  const offset = offsetByGrade[grade] ?? 0;
  return current - offset;
}

/** 序號至少三位數：1→001，999→999，1000→1000 */
export function formatStudentSequence(n: number): string {
  if (!Number.isFinite(n) || n < 1) return '001';
  const i = Math.floor(n);
  return i < 1000 ? String(i).padStart(3, '0') : String(i);
}

export function buildVisitorStudentId(entryYear: number, sequence: number): string {
  return `${entryYear}${formatStudentSequence(sequence)}`;
}

/** 業界人士學號：I + 註冊當下學年度 + 序號（與在學純數字學號分流） */
export function buildIndustryStudentId(registerYear: number, sequence: number): string {
  return `${INDUSTRY_ID_PREFIX}${registerYear}${formatStudentSequence(sequence)}`;
}

export function buildSchoolStudentId(schoolCode: string, schoolStudentNo: string): string {
  return `${String(schoolCode).trim().toUpperCase()}${String(schoolStudentNo).trim()}`;
}

export function isValidCustomAccount(account: string): boolean {
  return /^[A-Za-z0-9._-]{3,32}$/.test(account);
}

export function isValidSchoolStudentNo(no: string): boolean {
  return /^[A-Za-z0-9_-]{1,20}$/.test(no);
}

export type { RegisterGrade };
