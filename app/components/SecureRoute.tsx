'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, isAuthenticated } from '../utils/session';
import LoadingSpinner from './LoadingSpinner';

interface SecureRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'teacher' | 'student';
  fallback?: React.ReactNode;
}

export default function SecureRoute({ 
  children, 
  requiredRole, 
  fallback 
}: SecureRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      // 檢查是否已登入
      if (!isAuthenticated()) {
        console.warn('未授權訪問嘗試');
        router.push('/back-login');
        return;
      }

      const session = getSession();
      if (!session) {
        console.warn('Session 無效');
        router.push('/back-login');
        return;
      }

      // 檢查角色權限
      if (requiredRole && (Array.isArray(session.role) ? !session.role.includes(requiredRole) : session.role !== requiredRole)) {
        console.warn(`權限不足: 需要 ${requiredRole}，實際為 ${session.role}`);
        router.push('/back-login');
        return;
      }

      // 檢查是否為直接訪問（額外安全檢查）
      const referrer = document.referrer;
      const isDirectAccess = !referrer || referrer === '';
      const isFromSameOrigin = referrer.includes(window.location.origin);
      
      if (isDirectAccess && !isFromSameOrigin) {
        console.warn('可疑的直接訪問嘗試');
        router.push('/back-login');
        return;
      }

      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router, requiredRole]);

  if (isLoading) {
    return fallback || (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <LoadingSpinner size={64} text="驗證中..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return fallback || (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">存取被拒絕</h2>
          <p className="text-gray-600 mb-4">您沒有權限訪問此頁面</p>
          <button
            onClick={() => router.push('/back-login')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回登入頁面
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 