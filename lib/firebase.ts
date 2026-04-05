import 'server-only';
import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let initError: Error | null = null;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    const errorMsg = '❌ Firebase Admin SDK 初始化失敗：缺少環境變數。請檢查 .env 檔案中的 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY';
    console.error(errorMsg);
    initError = new Error(errorMsg);
  } else {
    try {
      initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      initError = error instanceof Error ? error : new Error(String(error));
    }
  }
}

// 防止在未初始化時崩潰，改為導出一個會拋出錯誤的物件
export const db = getApps().length 
  ? getFirestore(getApp()) 
  : {
      collection: () => { 
        throw new Error(`Firebase Admin 未正確初始化: ${initError?.message || '請檢查伺服器日誌與 .env 設定'}`); 
      }
    } as unknown as Firestore;