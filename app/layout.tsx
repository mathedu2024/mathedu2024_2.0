import type { Metadata } from "next";
import { Noto_Sans_TC, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import 'sweetalert2/dist/sweetalert2.min.css';
import Navigation from './components/Navigation';
import AutoLogout from './AutoLogout';

const notoSansTC = Noto_Sans_TC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const plusJakarta = Plus_Jakarta_Sans({
  weight: ['700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
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
    <html lang="zh-TW" className={`h-full scroll-smooth overflow-hidden ${notoSansTC.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`} data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/learn.png" type="image/png" />
        <link rel="icon" href="/learn.png" type="image/x-icon" />
        <link rel="shortcut icon" href="/learn.png" type="image/png" />
        <link rel="apple-touch-icon" href="/learn.png" />
        
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
        />
      </head>

      <body className={`${notoSansTC.className} bg-surface text-on-surface h-screen flex flex-col antialiased overflow-hidden`}>
        <AutoLogout />
        <Navigation />
        
        <main className="w-full flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
        </main>
        <div id="modal-root"></div>
      </body>
    </html>
  );
}
