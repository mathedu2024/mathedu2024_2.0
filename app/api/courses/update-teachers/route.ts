import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { teacherIds, courseName, courseCode, courseId, isUpdate, oldTeacherIds } = await req.json();
    
    console.log('update-teachers API - Received data:', {
      teacherIds,
      courseName,
      courseCode,
      courseId,
      isUpdate,
      oldTeacherIds
    });

    if (!teacherIds || !Array.isArray(teacherIds)) {
      return NextResponse.json({ error: 'Invalid teacherIds' }, { status: 400 });
    }

    const courseKey = `${courseName}(${courseCode})`;

    // 如果是更新操作，先從舊老師的授課清單中移除
    if (isUpdate && oldTeacherIds && Array.isArray(oldTeacherIds)) {
      for (const oldTeacherId of oldTeacherIds) {
        if (!teacherIds.includes(oldTeacherId)) {
          // 從舊老師的授課清單中移除
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
              
              console.log(`Removed course ${courseKey} from teacher ${oldTeacherId}`);
            }
          } catch (error) {
            console.error(`Error removing course from old teacher ${oldTeacherId}:`, error);
          }
        }
      }
    }

    // 為每個老師更新授課清單
    for (const teacherId of teacherIds) {
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

    return NextResponse.json({ 
      success: true, 
      message: `Successfully updated ${teacherIds.length} teachers` 
    });
  } catch (error) {
    console.error('update-teachers API - Error:', error);
    return NextResponse.json({ 
      error: (error as any).message || '更新老師課程失敗' 
    }, { status: 500 });
  }
} 