import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

const EXAMS = 'exam_dates';

export interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt?: string | Date;
}

export async function getExams() {
  const snapshot = await getDocs(collection(db, EXAMS));
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return data;
}

// Note: Functions for adding, updating, and deleting exams
// have been removed as they would require significant changes to security rules
// to be used securely in a client-only application.