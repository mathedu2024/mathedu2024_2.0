'use client';

import { getApps, initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 擴充 globalThis 型別以支援快取
declare global {
  var _firebaseApp: FirebaseApp | undefined;
  var _firestoreDb: Firestore | undefined;
}

// 1. 初始化 App (單例模式 - 使用 globalThis 防止 HMR 重複初始化)
let app: FirebaseApp;
if (process.env.NODE_ENV === 'development' && globalThis._firebaseApp) {
  app = globalThis._firebaseApp;
} else {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (process.env.NODE_ENV === 'development') {
    globalThis._firebaseApp = app;
  }
}

// 2. 獲取 Firestore 實例 (單例模式 - 使用 globalThis 防止 HMR 重複初始化)
let db: Firestore;
if (process.env.NODE_ENV === 'development' && globalThis._firestoreDb) {
  db = globalThis._firestoreDb;
} else {
  db = getFirestore(app);
  
  if (process.env.NODE_ENV === 'development' && db) {
    globalThis._firestoreDb = db;
  }
}

// 安全性檢查：如果 db 仍為 undefined (初始化完全失敗)，提供一個會拋出明確錯誤的替代物件
// 這能防止元件在使用 db.collection 時發生 "Cannot read properties of undefined" 的崩潰
if (!db) {
  db = {
    collection: () => { throw new Error('Firebase Client SDK 初始化失敗 (HMR)，請重新整理頁面'); },
  } as unknown as Firestore;
}

export { db };