import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';
import { cookies } from 'next/headers'; // Added comment to force recompile

export async function POST(req: NextRequest) {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
    if (!sessionData.role.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.json();
    const id = data.id || Date.now().toString();
    
    console.log('courses/update API - Received data:', data);
    
    if (!('startDate' in data)) data.startDate = '';
    if (!('endDate' in data)) data.endDate = '';
    
    // 獲取舊的課程資料以比較老師變更
    const oldCourseDoc = await adminDb.collection('courses').doc(id).get();
    const oldCourseData = oldCourseDoc.exists ? oldCourseDoc.data() : null;
    const oldTeacherIds = oldCourseData?.teachers || [];
    
    // 更新課程資料
    await adminDb.collection('courses').doc(id).set(data, { merge: true });
    
    // 如果老師有變更，同步更新老師的授課清單
    if (data.teachers && Array.isArray(data.teachers)) {
      try {
        const courseKey = `${data.name}(${data.code})`;
        
        // 從舊老師的授課清單中移除（如果不再擔任該課程）
        for (const oldTeacherId of oldTeacherIds) {
          if (!data.teachers.includes(oldTeacherId)) {
            try {
              const oldTeacherRef = adminDb.collection('users').doc(oldTeacherId);
              const oldTeacherDoc = await oldTeacherRef.get();
              
              if (oldTeacherDoc.exists) {
                const oldTeacherData = oldTeacherDoc.data();
                const oldCourses = oldTeacherData?.courses || [];
                const updatedCourses = oldCourses.filter((course: string) => course !== courseKey);
                
                await oldTeacherRef.update({
                  courses: updatedCourses,
                  updatedAt: new Date().toISOString()
                });
                
                console.log(`Removed course ${courseKey} from old teacher ${oldTeacherId}`);
              }
            } catch (error) {
              console.error(`Error removing course from old teacher ${oldTeacherId}:`, error);
            }
          }
        }
        
        // 為新老師添加課程到授課清單
        for (const teacherId of data.teachers) {
          try {
            const teacherRef = adminDb.collection('users').doc(teacherId);
            const teacherDoc = await teacherRef.get();
            
            if (teacherDoc.exists) {
              const teacherData = teacherDoc.data();
              const currentCourses = teacherData?.courses || [];
              
              // 檢查課程是否已經在清單中
              if (!currentCourses.includes(courseKey)) {
                const updatedCourses = [...currentCourses, courseKey];
                
                await teacherRef.update({
                  courses: updatedCourses,
                  updatedAt: new Date().toISOString()
                });
                
                console.log(`Added course ${courseKey} to teacher ${teacherId}`);
              } else {
                console.log(`Course ${courseKey} already exists for teacher ${teacherId}`);
              }
            } else {
              console.log(`Teacher ${teacherId} not found`);
            }
          } catch (error) {
            console.error(`Error updating teacher ${teacherId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error syncing teacher courses:', error);
      }
    }
    
    return NextResponse.json({ success: true, id });
  } catch (error: unknown) {
    let message = '更新課程失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 