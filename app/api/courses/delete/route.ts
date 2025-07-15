import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    
    console.log('courses/delete API - Deleting course:', id);
    
    // 獲取課程資料以取得老師資訊
    const courseDoc = await adminDb.collection('courses').doc(id).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    
    const courseData = courseDoc.data();
    const teacherIds = courseData?.teachers || [];
    const courseName = courseData?.name || '';
    const courseCode = courseData?.code || '';
    
    console.log('courses/delete API - Course data:', {
      courseName,
      courseCode,
      teacherIds
    });
    
    // 從老師的授課清單中移除課程
    if (teacherIds.length > 0) {
      const courseKey = `${courseName}(${courseCode})`;
      
      for (const teacherId of teacherIds) {
        try {
          const teacherRef = adminDb.collection('users').doc(teacherId);
          const teacherDoc = await teacherRef.get();
          
          if (teacherDoc.exists) {
            const teacherData = teacherDoc.data();
            const currentCourses = teacherData?.courses || [];
            
            // 移除課程
            const updatedCourses = currentCourses.filter((course: string) => course !== courseKey);
            
            await teacherRef.update({
              courses: updatedCourses,
              updatedAt: new Date().toISOString()
            });
            
            console.log(`Removed course ${courseKey} from teacher ${teacherId}`);
          } else {
            console.log(`Teacher ${teacherId} not found`);
          }
        } catch (error) {
          console.error(`Error removing course from teacher ${teacherId}:`, error);
        }
      }
    }
    
    // 刪除課程
    await adminDb.collection('courses').doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('courses/delete API - Error:', error);
    return NextResponse.json({ error: (error as any).message || '刪除失敗' }, { status: 500 });
  }
} 