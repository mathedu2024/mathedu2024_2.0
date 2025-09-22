import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Get session from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const session = JSON.parse(decodeURIComponent(sessionCookie.value));
    const userId = session?.id;

    if (!userId) {
      return NextResponse.json({ message: 'Invalid session' }, { status: 401 });
    }

    // 2. Get passwords from request body
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: '請提供目前密碼與新密碼' }, { status: 400 });
    }

    // 3. Fetch user document from the correct 'users' collection
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ message: '找不到使用者資料' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Prevent students from using this generic user password change route
    if (userData?.role === 'student') {
      return NextResponse.json({ message: 'Unauthorized: Students must use their specific password change route.' }, { status: 403 });
    }

    // 4. Verify current password (plain text storage, as per user request)
    if (userData?.password !== currentPassword) {
      return NextResponse.json({ message: '目前密碼不正確' }, { status: 400 });
    }

    // 5. Update to new password (plain text)
    await userRef.update({
      password: newPassword,
    });

    return NextResponse.json({ message: '密碼更新成功' });

  } catch (error) {
    console.error('Error changing user password:', error);
    return NextResponse.json({ message: '更新密碼時發生內部錯誤' }, { status: 500 });
  }
}
