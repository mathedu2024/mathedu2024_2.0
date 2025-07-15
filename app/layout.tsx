import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navigation from './components/Navigation';

const geist = Geist({
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
      <body className={`${geist.className} h-full flex flex-col`}>
        <Navigation />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}