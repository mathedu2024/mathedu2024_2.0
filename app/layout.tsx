import Script from "next/script";
import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import 'sweetalert2/dist/sweetalert2.min.css';
import Navigation from './components/Navigation';
import { StudentInfoProvider } from './components/StudentInfoContext';
import AutoLogout from './AutoLogout';

const notoSansTC = Noto_Sans_TC({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "高中學習資源教育網2.0",
  description: "提供高中學習資源與課程資訊的整合平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full scroll-smooth overflow-hidden">
      <head>
        <link rel="icon" href="/learn.png" type="image/png" />
        <link rel="icon" href="/learn.png" type="image/x-icon" />
        <link rel="shortcut icon" href="/learn.png" type="image/png" />
        <link rel="apple-touch-icon" href="/learn.png" />
        
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
        />

        <Script
          src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
          strategy="beforeInteractive"
        />
        <Script id="emailjs-init" strategy="beforeInteractive">
          {`emailjs.init("Oxm7lO3VyhQ4vxUTW");`}
        </Script>
      </head>

      <body className={`${notoSansTC.className} bg-gray-50 text-gray-900 h-screen flex flex-col antialiased overflow-hidden`}>
        <StudentInfoProvider>
          <AutoLogout />
          {/* Navigation 導覽列 */}
          <Navigation />
          
          <main className="w-full flex-1 overflow-y-auto overflow-x-hidden relative">
            {children}
          </main>
          
          <div id="modal-root"></div>
        </StudentInfoProvider>
      </body>
    </html>
  );
}