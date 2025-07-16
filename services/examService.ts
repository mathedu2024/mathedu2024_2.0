// import { db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';

const EXAMS = 'exam_dates';

export interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt?: string | Date;
}

export async function addExam(id: string, data: { name: string; startDate: string; endDate: string }) {
  return await fetch('/api/exam-dates/create', { method: 'POST', body: JSON.stringify({ id, ...data }) });
}

export async function getExams() {
  const res = await fetch('/api/exam-dates/list');
  const result = await res.json();
  return result;
}

export async function updateExam(id: string, data: { name: string; startDate: string; endDate: string }) {
  return await fetch('/api/exam-dates/update', { method: 'POST', body: JSON.stringify({ id, ...data }) });
}

export async function deleteExam(id: string) {
  return await fetch('/api/exam-dates/delete', { method: 'POST', body: JSON.stringify({ id }) });
}

// 取得所有考試
export const getAllExams = async () => {
  // ... existing code ...
} 