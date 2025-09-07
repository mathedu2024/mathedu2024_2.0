import { db } from './firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

// 公告事項 CRUD
export const getAnnouncements = async () => {
  try {
    console.log('Fetching announcements from Firestore...');
    const announcementsRef = collection(db, 'announcements');
    const q = query(announcementsRef, limit(20)); // 限制獲取數量以提高性能
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No announcements found in Firestore');
      return [];
    }
    
    console.log(`Successfully fetched ${snapshot.docs.length} announcements`);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    throw error; // 重新拋出錯誤以便上層處理
  }
};

// 課程資訊 CRUD
export const getCourseInfo = async () => {
  const snapshot = await getDocs(collection(db, 'course_info'));
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return data;
};

// Note: Functions for creating, updating, and deleting announcements and course info
// have been removed as they would require significant changes to security rules
// to be used securely in a client-only application.