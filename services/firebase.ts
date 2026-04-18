import { app, db, auth } from '@/lib/firebase-client';
import { getStorage } from 'firebase/storage';

// 統一從單一 client 入口取得 app/db/auth，避免多模組重複初始化。
const storage = getStorage(app);

export { db, storage, auth };
