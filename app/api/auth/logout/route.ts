import { NextResponse } from 'next/server';
import { serialize } from 'cookie';

/** 清除 session cookie（含舊版 httpOnly 與前端寫入的非 httpOnly） */
export async function POST() {
  const clearHttpOnly = serialize('session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
  });
  const clearClient = serialize('session', '', {
    httpOnly: false,
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
  });

  const response = new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  response.headers.append('Set-Cookie', clearHttpOnly);
  response.headers.append('Set-Cookie', clearClient);
  return response;
}
