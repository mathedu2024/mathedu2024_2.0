import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// 公告事項 CRUD
export const getAnnouncements = async () => {
  const snapshot = await getDocs(collection(db, 'announcements'));
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return data;
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