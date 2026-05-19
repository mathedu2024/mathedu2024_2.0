import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // 增加對 undefined 的處理，避免 replace 出錯
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

function getAdminApp(): App {
  // 如果已經有初始化的 app，直接回傳，避免重複執行
  if (getApps().length > 0) {
    return getApp();
  }

  // 否則，初始化一個新的 app
  // 將日誌放在這裡，可以確保只在真正初始化時才印出
  console.log('Initializing Firebase Admin SDK...');
  const newApp = initializeApp({
    credential: cert(serviceAccount),
  });
  console.log('Firebase Admin SDK initialized successfully.');
  return newApp;
}

export const adminDb = getFirestore(getAdminApp());