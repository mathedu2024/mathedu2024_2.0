'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, isAuthenticated } from '@/utils/session';
import LoadingSpinner from './LoadingSpinner';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

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
        router.push('/login'); // Redirect to unified login or specific login based on role if needed
        return;
      }

      const session = getSession();
      if (!session) {
        console.warn('Session 無效');
        router.push('/login');
        return;
      }

      // 檢查角色權限
      if (requiredRole) {
        const userRoles = Array.isArray(session.role) ? session.role : [session.role];
        const hasRole = userRoles.includes(requiredRole);
        
        if (!hasRole) {
            console.warn(`權限不足: 需要 ${requiredRole}，實際為 ${session.role}`);
            // Redirect based on role to appropriate dashboard or login
            if (userRoles.includes('student')) {
                router.push('/student');
            } else if (userRoles.includes('teacher') || userRoles.includes('admin')) {
                router.push('/back-panel');
            } else {
                router.push('/login');
            }
            return;
        }
      }

      // 檢查是否為直接訪問（額外安全檢查 - Optional, sometimes causes issues with valid redirects）
      // Removed strict referrer check as it can block valid navigation in some SPA contexts or new tabs
      // If needed, ensure it only blocks suspicious external direct links if that's the goal.

      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router, requiredRole]);

  if (isLoading) {
    return fallback || (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-[9999]">
        <div className="flex flex-col items-center">
            <LoadingSpinner size={64} />
            <p className="mt-4 text-gray-500 font-medium animate-pulse">驗證權限中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return fallback || (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 animate-bounce-in">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldExclamationIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">存取被拒絕</h2>
          <p className="text-gray-500 mb-8">抱歉，您沒有權限訪問此頁面。<br/>請確認您的帳號權限或重新登入。</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold"
          >
            返回登入頁面
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}