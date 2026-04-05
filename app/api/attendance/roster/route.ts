import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  console.log('[API] POST /api/attendance/roster started'); // Log: 開始請求

  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  // Log: Session 狀態
  console.log('[API] Session:', session ? `User: ${session.account}, Role: ${session.role}, UID: ${session.uid}` : 'No Session');

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    console.warn('[API] Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { activityId, courseId } = await req.json();
    
    // Log: 接收到的參數
    console.log(`[API] Payload - Activity: ${activityId}, Course: ${courseId}`);

    if (!activityId || !courseId) {
      return NextResponse.json({ error: 'Activity ID and Course ID are required' }, { status: 400 });
    }

    // 根據您的指示：首先確定老師的授課課程
    // 路徑結構：users/{uid}/courses/{courseId}
    // courseId 格式為 "課程名稱(課程代碼)"，例如："2024高三[數A]暑期學測複習班(A)(M20241211)"
    if (session.role.includes('teacher') && !session.role.includes('admin')) {
      // 確認資料庫架構 (基於 4-0-0 Log 分析)：
      // 1. 老師與課程的關聯使用 UUID (如 3c187ba3...)
      // 2. 關聯欄位為 'teachers' (而非 teacherUids)
      const userId = session.uid || session.id;
      
      if (!userId) {
        console.error('[API] Teacher session missing User ID');
        return NextResponse.json({ error: 'Unauthorized: Missing user ID in session' }, { status: 401 });
      }

      // 檢查策略 1: 查詢 users/{uid} 文件的 courses 陣列
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      // Log: 授課權限驗證結果
      console.log(`[API] Verifying course ownership for user: ${userId}`);
      
      // 檢查 users/{uid} 的 courses 陣列是否包含此 courseId
      const hasCourseInUser = userData?.courses && Array.isArray(userData.courses) && userData.courses.includes(courseId);
      console.log(`[API] User has course in list: ${hasCourseInUser}`);

      if (!hasCourseInUser) {
        console.log(`[API] User courses list: ${JSON.stringify(userData?.courses)}`); // Debug: 印出使用者的課程列表

        // 檢查策略 2: (Fallback) 查詢 courses/{courseId} 文件，進行多欄位交叉比對 (參考 courses/list 邏輯)
        const courseDoc = await db.collection('courses').doc(courseId).get();
        const courseData = courseDoc.data();
        
        const teachers = Array.isArray(courseData?.teachers) ? courseData.teachers : [];
        const teacherUids = Array.isArray(courseData?.teacherUids) ? courseData.teacherUids : [];
        const userAccount = session.account;

        // 模擬 courses/list 的交叉比對邏輯：
        // 1. 檢查 UUID 是否在 teachers 欄位 (主要)
        const isIdInTeachers = teachers.includes(userId);
        // 2. 檢查 Account 是否在 teacherUids 欄位
        const isAccountInTeacherUids = userAccount ? teacherUids.includes(userAccount) : false;
        // 3. 交叉檢查 (容錯)：UUID 在 teacherUids 或 Account 在 teachers
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

    // 使用 Admin SDK 直接查詢
    // 完整路徑結構：courses/{courseId}/attendance/{activityId}/roster
    const activityRef = db.collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId);

    // 增加檢查：確認活動文件是否存在，這有助於判斷是路徑錯誤還是單純沒資料
    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) {
      console.warn(`[API] Warning: Activity document not found at ${activityRef.path}`);
    }

    const rosterRef = activityRef.collection('roster');
    const snapshot = await rosterRef.get();

    // Log: 查詢結果
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
          status: 'present', // 預設為出席
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