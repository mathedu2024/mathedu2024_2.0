import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, limit, where } from 'firebase/firestore';

// 認證快取
const authCache = new Map<string, { data: unknown; timestamp: number }>();
const AUTH_CACHE_DURATION = 15 * 60 * 1000; // 增加到15分鐘快取

// 快取統計
let cacheHits = 0;
let cacheMisses = 0;

// 預載入的用戶資料
const preloadedUsers = new Map<string, unknown>();

// 網路狀態檢測
let isOnline = navigator.onLine;

// 監聽網路狀態
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('網路已連接');
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('網路已斷開');
  });
}

// 發送快取統計事件
const sendCacheStats = () => {
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cache-stats', {
      detail: {
        hitRate,
        cacheHits,
        cacheMisses,
        totalRequests,
        cacheSize: authCache.size
      }
    }));
  }
};

// 預載入常用用戶資料
export const preloadUserData = async () => {
  try {
    if (!isOnline) {
      console.log('離線模式，跳過預載入');
      return;
    }

    // 預載入最近登入的用戶資料（限制數量避免過度載入）
    const usersQuery = query(collection(db, 'users'), limit(50));
    const snapshot = await getDocs(usersQuery);
    
    snapshot.docs.forEach(doc => {
      const userData = doc.data();
      userData.id = doc.id;
      preloadedUsers.set(doc.id, userData);
    });
    
    console.log(`用戶資料預載入完成，共載入 ${snapshot.docs.length} 筆資料`);
  } catch (error) {
    console.warn('用戶資料預載入失敗:', error);
  }
};

// 驗證學生登入
export const validateStudentLogin = async (account: string, password: string) => {
  const cacheKey = `student_auth_${account}`;
  
  // 檢查快取
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AUTH_CACHE_DURATION) {
    const userData = cached.data;
    if (userData.password === password) {
      // 快取命中
      cacheHits++;
      sendCacheStats();
      console.log(`快取命中: ${account}`);
      return userData;
    }
    // 密碼不匹配，不算快取命中
    cacheMisses++;
    sendCacheStats();
    return null;
  }
  
  // 檢查預載入資料
  const preloaded = preloadedUsers.get(account.trim());
  if (preloaded && preloaded.password === password && preloaded.role === 'student') {
    // 預載入資料命中
    cacheHits++;
    sendCacheStats();
    console.log(`預載入命中: ${account}`);
    
    // 更新快取
    authCache.set(cacheKey, {
      data: preloaded,
      timestamp: Date.now()
    });
    
    return preloaded;
  }
  
  // 快取未命中
  cacheMisses++;
  sendCacheStats();
  console.log(`快取未命中: ${account}`);
  
  try {
    // 根據網路狀態調整超時時間
    const timeoutDuration = isOnline ? 2000 : 5000; // 離線時給更多時間
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('驗證超時')), timeoutDuration);
    });
    
    // 查詢 users 集合中的學生帳號
    const userQuery = query(collection(db, 'users'), where('account', '==', account.trim()), where('role', '==', 'student'));
    const userDocSnapPromise = getDocs(userQuery);
    
    const userDocSnap = await Promise.race([userDocSnapPromise, timeoutPromise]) as unknown;
    
    if (userDocSnap.empty) {
      return null;
    }
    
    const userData = userDocSnap.docs[0].data();
    userData.id = userDocSnap.docs[0].id; // 確保 userInfo.id 是 document id
    
    // 快取用戶資料（包含密碼用於驗證）
    authCache.set(cacheKey, {
      data: userData,
      timestamp: Date.now()
    });
    
    // 同時更新預載入資料
    preloadedUsers.set(account.trim(), userData);
    
    if (userData.password === password) {
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error('學生登入驗證失敗:', error);
    
    // 如果是網路錯誤，嘗試使用預載入資料
    if (error instanceof Error && error.message.includes('驗證超時')) {
      console.log('嘗試使用預載入資料進行驗證');
      const preloaded2 = preloadedUsers.get(account.trim());
      if (preloaded2 && preloaded2.password === password && preloaded2.role === 'student') {
        console.log(`使用預載入資料驗證成功: ${account}`);
        return preloaded2;
      }
    }
    
    throw error;
  }
};

// 驗證教師/管理員登入
export const validateTeacherLogin = async (account: string, password: string) => {
  const cacheKey = `teacher_auth_${account}`;
  
  // 檢查快取
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AUTH_CACHE_DURATION) {
    const userData = cached.data;
    if (userData.password === password) {
      // 快取命中
      cacheHits++;
      sendCacheStats();
      console.log(`快取命中: ${account}`);
      return userData;
    }
    // 密碼不匹配，不算快取命中
    cacheMisses++;
    sendCacheStats();
    return null;
  }
  
  // 檢查預載入資料
  const preloaded = preloadedUsers.get(account.trim());
  if (preloaded && preloaded.password === password && (preloaded.role === 'teacher' || preloaded.role === 'admin')) {
    // 預載入資料命中
    cacheHits++;
    sendCacheStats();
    console.log(`預載入命中: ${account}`);
    
    // 更新快取
    authCache.set(cacheKey, {
      data: preloaded,
      timestamp: Date.now()
    });
    
    return preloaded;
  }
  
  // 快取未命中
  cacheMisses++;
  sendCacheStats();
  console.log(`快取未命中: ${account}`);
  
  try {
    // 根據網路狀態調整超時時間
    const timeoutDuration = isOnline ? 2000 : 5000;
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('驗證超時')), timeoutDuration);
    });
    
    // 查詢 users 集合中的教師/管理員帳號
    const userQuery = query(collection(db, 'users'), where('account', '==', account.trim()), where('role', 'in', ['teacher', 'admin']));
    const userDocSnapPromise = getDocs(userQuery);
    
    const userDocSnap = await Promise.race([userDocSnapPromise, timeoutPromise]) as unknown;
    
    if (userDocSnap.empty) {
      return null;
    }
    
    const userData = userDocSnap.docs[0].data();
    userData.id = userDocSnap.docs[0].id; // 確保 userInfo.id 是 document id
    
    // 快取用戶資料（包含密碼用於驗證）
    authCache.set(cacheKey, {
      data: userData,
      timestamp: Date.now()
    });
    
    // 同時更新預載入資料
    preloadedUsers.set(account.trim(), userData);
    
    if (userData.password === password) {
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error('教師登入驗證失敗:', error);
    
    // 如果是網路錯誤，嘗試使用預載入資料
    if (error instanceof Error && error.message.includes('驗證超時')) {
      console.log('嘗試使用預載入資料進行驗證');
      const preloaded2 = preloadedUsers.get(account.trim());
      if (preloaded2 && preloaded2.password === password && (preloaded2.role === 'teacher' || preloaded2.role === 'admin')) {
        console.log(`使用預載入資料驗證成功: ${account}`);
        return preloaded2;
      }
    }
    
    throw error;
  }
};

// 清除認證快取
export const clearAuthCache = (account?: string) => {
  if (account) {
    authCache.delete(`student_auth_${account}`);
    authCache.delete(`teacher_auth_${account}`);
    preloadedUsers.delete(account.trim());
  } else {
    authCache.clear();
    preloadedUsers.clear();
  }
  // 重置統計
  cacheHits = 0;
  cacheMisses = 0;
  sendCacheStats();
};

// 獲取快取統計
export const getCacheStats = () => {
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
  
  return {
    cacheSize: authCache.size,
    preloadedUsersSize: preloadedUsers.size,
    cacheHits,
    cacheMisses,
    totalRequests,
    hitRate,
    isOnline
  };
};

// 重置快取統計
export const resetCacheStats = () => {
  cacheHits = 0;
  cacheMisses = 0;
  sendCacheStats();
};

// 手動觸發預載入
export const triggerPreload = () => {
  preloadUserData();
}; 