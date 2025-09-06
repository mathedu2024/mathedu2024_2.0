import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import 'sweetalert2/dist/sweetalert2.min.css';
import Navigation from './components/Navigation';

const geistFont = Geist({
  subsets: ["latin"],
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
    <html lang="zh-TW" className="h-full">
      <head>
        {/* 全面置換 favicon 為 learn.png，支援多格式 */}
        <link rel="icon" href="/learn.png" type="image/png" />
        <link rel="icon" href="/learn.png" type="image/x-icon" />
        <link rel="shortcut icon" href="/learn.png" type="image/png" />
        <link rel="apple-touch-icon" href="/learn.png" />
      </head>
      <body className={`${geistFont.className} h-full flex flex-col overflow-hidden`}>
        <Navigation />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}