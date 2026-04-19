import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  console.log('[API] POST /api/attendance/roster started'); // Log: 開始請求

  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  console.log('[API] Session:', session ? `User: ${session.account}, Role: ${session.role}, UID: ${session.uid}` : 'No Session');

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    console.warn('[API] Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { activityId, courseId } = await req.json();
    
    console.log(`[API] Payload - Activity: ${activityId}, Course: ${courseId}`);

    if (!activityId || !courseId) {
      return NextResponse.json({ error: 'Activity ID and Course ID are required' }, { status: 400 });
    }

    if (session.role.includes('teacher') && !session.role.includes('admin')) {
      const userId = session.uid || session.id;
      
      if (!userId) {
        console.error('[API] Teacher session missing User ID');
        return NextResponse.json({ error: 'Unauthorized: Missing user ID in session' }, { status: 401 });
      }

      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      console.log(`[API] Verifying course ownership for user: ${userId}`);
      
      const hasCourseInUser = userData?.courses && Array.isArray(userData.courses) && userData.courses.includes(courseId);
      console.log(`[API] User has course in list: ${hasCourseInUser}`);

      if (!hasCourseInUser) {
        console.log(`[API] User courses list: ${JSON.stringify(userData?.courses)}`); // Debug: 印出使用者的課程列表

        const courseDoc = await db.collection('courses').doc(courseId).get();
        const courseData = courseDoc.data();
        
        const teachers = Array.isArray(courseData?.teachers) ? courseData.teachers : [];
        const teacherUids = Array.isArray(courseData?.teacherUids) ? courseData.teacherUids : [];
        const userAccount = session.account;

        const isIdInTeachers = teachers.includes(userId);
        const isAccountInTeacherUids = userAccount ? teacherUids.includes(userAccount) : false;
        const isIdInTeacherUids = teacherUids.includes(userId);
        const isAccountInTeachers = userAccount ? teachers.includes(userAccount) : false;

        const isAuthorized = isIdInTeachers || isAccountInTeacherUids || isIdInTeacherUids || isAccountInTeachers;
        
        console.log(`[API] Auth Check - ID(${userId}) in teachers: ${isIdInTeachers}, Account(${userAccount}) in teacherUids: ${isAccountInTeacherUids}`);
        
        if (!isAuthorized) {
          console.log(`[API] Auth Failed. Teachers: ${JSON.stringify(teachers)}, TeacherUids: ${JSON.stringify(teacherUids)}`);
          return NextResponse.json({ error: 'Unauthorized: You do not teach this course' }, { status: 403 });
        }
      }
    }

    // 完整路徑結構：courses/{courseId}/attendance/{activityId}/roster
    const activityRef = db.collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId);

    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) {
      console.warn(`[API] Warning: Activity document not found at ${activityRef.path}`);
    }

    const rosterRef = activityRef.collection('roster');
    const snapshot = await rosterRef.get();

    console.log(`[API] Querying roster at: ${rosterRef.path}`);
    console.log(`[API] Found ${snapshot.size} records for activity ${activityId}`);

    let roster = [];

    if (snapshot.empty) {
      // 若無點名紀錄，改從 courses/{courseId}/students 子集合讀取學生名單
      console.log('[API] Roster is empty. Fetching from course students subcollection...');
      const studentsRef = db.collection('courses').doc(courseId).collection('students');
      const studentsSnapshot = await studentsRef.get();

      console.log(`[API] Found ${studentsSnapshot.size} students in subcollection: ${studentsRef.path}`);

      roster = studentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          studentId: data.studentId || data.studentCode || '',
          status: 'present', 
          leaveType: undefined,
          remarks: ''
        };
      });
    } else {
      roster = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.studentId || doc.id,
          name: data.studentName || data.name,
          studentId: data.studentCode || data.studentId,
          status: data.status,
          leaveType: data.leaveType,
          remarks: data.remarks
        };
      });
    }

    return NextResponse.json(roster);

  } catch (error) {
    console.error('[API] Error in /api/attendance/roster:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}