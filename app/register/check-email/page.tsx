import { Suspense } from 'react';
import CheckEmailClient from './CheckEmailClient';

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-on-surfaceVariant">
          載入中...
        </div>
      }
    >
      <CheckEmailClient />
    </Suspense>
  );
}
