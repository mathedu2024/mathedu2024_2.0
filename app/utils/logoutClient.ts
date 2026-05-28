'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { clearSession } from './session';

/** 完整登出：清除 session/cookie、Firebase Auth，並通知全站 UI 更新 */
export async function logoutClient(redirectTo?: string): Promise<void> {
  clearSession();
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (error) {
    console.warn('Firebase signOut failed:', error);
  }

  if (redirectTo && typeof window !== 'undefined') {
    window.location.assign(redirectTo);
  }
}
