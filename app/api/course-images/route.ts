import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 取得 public/課程介紹圖片 目錄的絕對路徑
    const dir = path.join(process.cwd(), 'public', '課程介紹圖片');
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    // 產生可用於前端 img src 的路徑
    const images = files.map(f => `/課程介紹圖片/${encodeURIComponent(f)}`);
    return NextResponse.json({ images });
  } catch (error: unknown) {
    let message = '上傳失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  // This function is not used in the provided code, so it's removed.
} 