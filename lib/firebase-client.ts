'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 初始化 Firebase App (Singleton Pattern)
// getApps().length > 0 檢查是否已初始化，這在 HMR 和 Build 階段都能有效防止報錯
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 初始化服務
let db: Firestore;
try {
  // 嘗試初始化 Firestore，若需要設定離線暫存等參數，請加在第二個參數的物件中
  db = initializeFirestore(app, {});
} catch (error) {
  // 捕捉 HMR 造成的重複初始化錯誤，降級使用已存在的實例
  db = getFirestore(app);
}
const auth: Auth = getAuth(app);

export { app, db, auth };