import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseId, courseName, courseCode, teacherIds } = await req.json();
    
    console.log('remove-from-teachers API - Received data:', {
      courseId,
      courseName,
      courseCode,
      teacherIds
    });

    if (!teacherIds || !Array.isArray(teacherIds)) {
      return NextResponse.json({ error: 'Invalid teacherIds' }, { status: 400 });
    }

    const courseKey = `${courseName}(${courseCode})`;

    // 從每個老師的授課清單中移除課程
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

    return NextResponse.json({ 
      success: true, 
      message: `Successfully removed course from ${teacherIds.length} teachers` 
    });
  } catch (error) {
    console.error('remove-from-teachers API - Error:', error);
    return NextResponse.json({ 
      error: (error as any).message || '從老師課程移除失敗' 
    }, { status: 500 });
  }
} 