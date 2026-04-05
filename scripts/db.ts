import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 注意：請確保您已設定環境變數 FIREBASE_SERVICE_ACCOUNT_KEY
// 或是將 service-account.json 檔案路徑填入
// 範例： const serviceAccount = require('./service-account.json');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : {}; // 若無設定，請在此填入您的金鑰物件，或確保環境變數正確

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const db = getFirestore();