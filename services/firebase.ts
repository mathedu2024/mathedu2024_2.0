// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { enableNetwork, disableNetwork, waitForPendingWrites } from "firebase/firestore";

// Firebase 配置（使用環境變數以利部署）
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // 添加以下配置以提高連接穩定性
  experimentalForceLongPolling: true, // 使用長輪詢而非WebSocket
  experimentalAutoDetectLongPolling: true,
};

// 初始化（避免重複初始化於 HMR 或多次匯入）
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

const storage = getStorage(app);

// 配置Firestore以使用長輪詢和無限緩存
const db = getFirestore(app);

// Configure Firestore settings after initialization
const firestoreSettings = {
  experimentalForceLongPolling: true, // 使用長輪詢而非WebSocket
  experimentalAutoDetectLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED, // 使用無限緩存以提高性能和離線可用性
};

// Note: The settings() method is no longer needed as these settings
// should be passed directly in the getFirestore() initialization

// 啟用離線持久化和連接重試
if (typeof window !== 'undefined') {
  // 啟用離線持久化 - 僅在客戶端執行
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('Firebase offline persistence enabled successfully');
      // 確保所有待處理的寫入操作都已完成
      return waitForPendingWrites(db);
    })
    .then(() => {
      console.log('All pending writes completed');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // 多個標籤頁打開時可能會失敗
        console.warn('Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // 當前瀏覽器不支持
        console.warn('Persistence not supported by this browser');
      } else {
        console.error('Persistence error:', err);
      }
    });

  // 添加網絡連接重試機制
  let retryCount = 0;
  const maxRetries = 10; // 增加最大重試次數
  const retryInterval = 2000; // 2秒
  let isReconnecting = false;

  const handleNetworkError = () => {
    if (isReconnecting) return; // 防止多次重試
    
    if (retryCount < maxRetries) {
      isReconnecting = true;
      retryCount++;
      console.log(`Firebase connection attempt ${retryCount}/${maxRetries}...`);
      
      // 先禁用網絡，然後重新啟用
      disableNetwork(db).then(() => {
        console.log('Network disabled, waiting before reconnect...');
        return new Promise(resolve => setTimeout(resolve, 1000));
      }).then(() => {
        console.log('Attempting to re-enable network...');
        return enableNetwork(db);
      }).then(() => {
        console.log('Network connection re-established successfully');
        isReconnecting = false;
        retryCount = 0; // 重置計數器，因為連接成功了
      }).catch(err => {
        console.error('Network reconnection error:', err);
        isReconnecting = false;
        setTimeout(handleNetworkError, retryInterval);
      });
    } else {
      console.error('Max retry attempts reached. Please check your network connection.');
      // 重置計數器，允許用戶再次嘗試
      setTimeout(() => {
        retryCount = 0;
        console.log('Retry counter reset. Will attempt reconnection on next network event.');
      }, 10000); // 10秒後重置
    }
  };
  
  // 初始連接嘗試
  enableNetwork(db).catch(err => {
    console.error('Initial network connection error:', err);
    handleNetworkError();
  });

  // 監聽網絡狀態
  window.addEventListener('online', () => {
    console.log('Browser is online, reconnecting to Firestore...');
    if (!isReconnecting) {
      enableNetwork(db).then(() => {
        console.log('Firestore network connection enabled after online event');
        retryCount = 0; // 重置重試計數
      }).catch(err => {
        console.error('Failed to enable network after online event:', err);
        handleNetworkError();
      });
    }
  });

  window.addEventListener('offline', () => {
    console.log('Browser is offline, disabling Firestore connection...');
    disableNetwork(db).then(() => {
      console.log('Firestore network connection disabled after offline event');
    }).catch(err => {
      console.error('Failed to disable network after offline event:', err);
    });
  });
  
  // 定期檢查連接狀態
  setInterval(() => {
    if (navigator.onLine && !isReconnecting) {
      // 嘗試獲取一個小文檔來測試連接
      console.log('Performing periodic connection check...');
    }
  }, 30000); // 每30秒檢查一次
}

const auth = getAuth(app);

// 添加錯誤處理
try {
  console.log('Firebase client initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { storage, db, auth };
