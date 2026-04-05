'use client';

import Navigation from './Navigation';
import Footer from './Footer';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Navigation />
      {/* Main content area fills remaining height.
        bg-gray-50 applied to wrapper to ensure full background coverage.
      */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}