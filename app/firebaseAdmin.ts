import * as admin from 'firebase-admin';

// 從環境變數中讀取 Firebase Admin SDK 的設定
// 確保你的 .env.local 或部署環境中已設定這些變數
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// 檢查是否已經初始化，避免重複初始化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 匯出 Firestore 資料庫實例，供其他模組使用
export const adminDb = admin.firestore();