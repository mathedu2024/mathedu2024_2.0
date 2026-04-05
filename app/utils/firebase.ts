import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { 
  getFirestore, 
  type Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  type FirestoreSettings
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * 定義全域快取介面
 * 這是為了解決 Next.js 在開發模式下 HMR (熱更新) 會重複初始化導致報錯的問題
 */
declare global {
  var _firebaseApp: FirebaseApp | undefined;
  var _firebaseAuth: Auth | undefined;
  var _firebaseDb: Firestore | undefined;
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

/**
 * ------------------------------------------------------------------
 * 核心邏輯：
 * 1. 檢查是否已經有初始化的 App (getApps)。
 * 2. 如果沒有，則進行初始化 (initializeApp + initializeFirestore)。
 * 3. 如果有，則直接獲取現有實例 (getApp + getFirestore)。
 * ------------------------------------------------------------------
 */

if (!getApps().length) {
  // --- A. 第一次初始化 (Cold Start) ---
  
  app = initializeApp(firebaseConfig);

  // 設定 Firestore 選項
  const firestoreSettings: FirestoreSettings = {
    ignoreUndefinedProperties: true, // 允許寫入 undefined 屬性 (會被忽略)
  };

  // 僅在瀏覽器端 (Client Side) 啟用離線快取
  // 避免在 Server Side (Node.js) 環境下因存取 window 而報錯
  if (typeof window !== 'undefined') {
    firestoreSettings.localCache = persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    });
  }

  // 這裡使用 initializeFirestore 來套用我們的設定
  db = initializeFirestore(app, firestoreSettings);
  
  auth = getAuth(app);

  // 如果是開發環境，將實例存入 globalThis 以便熱更新時重用
  if (process.env.NODE_ENV === 'development') {
    globalThis._firebaseApp = app;
    globalThis._firebaseAuth = auth;
    globalThis._firebaseDb = db;
  }

} else {
  // --- B. 已經初始化過 (Hot Reload / Re-entry) ---
  
  // 直接使用既有的 App 實例
  app = getApp();

  // 這裡非常關鍵：
  // 既然 App 已經存在，代表 initializeFirestore 肯定在第一次就執行過了。
  // 此時絕對**不能**再次呼叫 initializeFirestore，否則會報錯 "already called with different options"。
  // 我們應該直接呼叫 getFirestore() 來拿回原本已經設定好的實例。
  
  if (process.env.NODE_ENV === 'development' && globalThis._firebaseDb) {
     // 開發環境：優先從 global 變數拿，最穩
     db = globalThis._firebaseDb;
     auth = globalThis._firebaseAuth || getAuth(app);
  } else {
     // 生產環境或 global 遺失：從 Firebase SDK 拿回單例
     db = getFirestore(app);
     auth = getAuth(app);
  }
}

export { app, auth, db };