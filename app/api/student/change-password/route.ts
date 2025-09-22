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
    const studentDocId = session?.id; // Assuming session.id is the document ID

    if (!studentDocId) {
      return NextResponse.json({ message: 'Invalid session or missing student ID' }, { status: 401 });
    }

    // 2. Get passwords from request body
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: '請提供目前密碼與新密碼' }, { status: 400 });
    }

    // 3. Fetch student document from student_data collection using its document ID
    const studentDocRef = adminDb.collection('student_data').doc(studentDocId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return NextResponse.json({ message: '找不到使用者資料' }, { status: 404 });
    }

    const studentData = studentDoc.data();

    // 4. Verify current password
    if (studentData?.password !== currentPassword) {
      return NextResponse.json({ message: '目前密碼不正確' }, { status: 400 });
    }

    // 5. Update to new password
    await studentDoc.ref.update({
      password: newPassword,
    });

    return NextResponse.json({ message: '密碼更新成功' });

  } catch (error) {
    console.error('Error changing student password:', error);
    return NextResponse.json({ message: '更新密碼時發生內部錯誤' }, { status: 500 });
  }
}