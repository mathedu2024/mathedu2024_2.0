import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const EXAMS = 'exam_dates';

export interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt?: string | Date;
}

export async function getExams() {
  try {
    console.log('Fetching exam dates from Firestore...');
    const examsRef = collection(db, EXAMS);
    const q = query(examsRef, orderBy('startDate'), limit(10)); // 按日期排序並限制數量
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No exam dates found in Firestore');
      return [];
    }
    
    console.log(`Successfully fetched ${snapshot.docs.length} exam dates`);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    console.error('Error fetching exam dates:', error);
    throw error; // 重新拋出錯誤以便上層處理
  }
}

export async function deleteExam(id: string) {
  try {
    const response = await fetch(`/api/exam-dates/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete exam date');
    }

    return response.json();
  } catch (error) {
    console.error('Error deleting exam date:', error);
    throw error;
  }
}