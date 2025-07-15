import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 這裡應該要加入實際的驗證邏輯
    // 這只是示範用的假驗證
    if (username === 'admin' && password === 'admin123') {
      return NextResponse.json({
        success: true,
        role: 'admin',
        message: '登入成功'
      });
    } else if (username === 'teacher' && password === 'teacher123') {
      return NextResponse.json({
        success: true,
        role: 'teacher',
        message: '登入成功'
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: '帳號或密碼錯誤'
      },
      { status: 401 }
    );
  } catch (err) {
    console.error('Panel API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


