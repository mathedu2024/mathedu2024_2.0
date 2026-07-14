'use client';

import {
  browserSessionPersistence,
  setPersistence,
  signInWithCustomToken,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

/** 以瀏覽器工作階段持久化登入 Firebase，關閉瀏覽器後不殘留 Auth 狀態 */
export async function signInWithSessionToken(token: string): Promise<void> {
  await setPersistence(auth, browserSessionPersistence);
  await signInWithCustomToken(auth, token);
}
