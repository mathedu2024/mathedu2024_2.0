import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import type { Query } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // 可根據需求過濾 teacherId
    const { teacherId } = await req.json();
    console.log('courses/list API - Received teacherId:', teacherId);
    
    const query: Query = adminDb.collection('courses');
    
    if (teacherId) {
      // 首先嘗試獲取老師的完整資訊
      let teacherInfo = null;
      try {
        console.log('courses/list API - Looking up teacher by ID:', teacherId);
        const teacherSnapshot = await adminDb.collection('users').doc(teacherId).get();
        if (teacherSnapshot.exists) {
          teacherInfo = { id: teacherSnapshot.id, ...teacherSnapshot.data() };
          console.log('courses/list API - Found teacher by ID:', teacherInfo);
        } else {
          console.log('courses/list API - Teacher not found by ID');
        }
      } catch {
        console.log('courses/list API - Teacher not found by ID, trying account lookup');
      }
      
      // 如果沒有找到老師資訊，嘗試用account查詢
      if (!teacherInfo) {
        try {
          console.log('courses/list API - Looking up teacher by account:', teacherId);
          const teacherSnapshot = await adminDb.collection('users').where('account', '==', teacherId).get();
          if (!teacherSnapshot.empty) {
            const doc = teacherSnapshot.docs[0];
            teacherInfo = { id: doc.id, ...doc.data() };
            console.log('courses/list API - Found teacher by account:', teacherInfo);
          } else {
            console.log('courses/list API - Teacher not found by account');
          }
        } catch {
          console.log('courses/list API - Teacher not found by account');
        }
      }
      
      // 收集所有可能的ID格式
      const possibleIds = [teacherId];
      if (teacherInfo) {
        possibleIds.push(teacherInfo.id);
        if ((teacherInfo as unknown as { uid: string }).uid) possibleIds.push((teacherInfo as unknown as { uid: string }).uid);
        if ((teacherInfo as unknown as { account: string }).account) possibleIds.push((teacherInfo as unknown as { account: string }).account);
      }
      
      // 去重
      const uniqueIds = [...new Set(possibleIds)];
      console.log('courses/list API - Searching with IDs:', uniqueIds);
      
      // 查詢所有可能的ID組合
      const allCourses = new Map();
      
      for (const id of uniqueIds) {
        try {
          console.log('courses/list API - Querying teacherUids for ID:', id);
          // 查詢 teacherUids 欄位
          const snapshot1 = await query.where('teacherUids', 'array-contains', id).get();
          console.log('courses/list API - Found', snapshot1.docs.length, 'courses in teacherUids for ID:', id);
          snapshot1.docs.forEach(doc => {
            const course = { id: doc.id, ...doc.data() };
            allCourses.set(course.id, course);
          });
          
          console.log('courses/list API - Querying teachers for ID:', id);
          // 查詢 teachers 欄位
          const snapshot2 = await query.where('teachers', 'array-contains', id).get();
          console.log('courses/list API - Found', snapshot2.docs.length, 'courses in teachers for ID:', id);
          snapshot2.docs.forEach(doc => {
            const course = { id: doc.id, ...doc.data() };
            allCourses.set(course.id, course);
          });
          
          // 查詢 teacherAccounts 欄位
          const snapshot3 = await query.where('teacherAccounts', 'array-contains', id).get();
          snapshot3.docs.forEach(doc => {
            const course = { id: doc.id, ...doc.data() };
            allCourses.set(course.id, course);
          });
        } catch {
          // 查詢失敗時略過
        }
      }
      
      const courses = Array.from(allCourses.values());
      console.log(`courses/list API - Found ${courses.length} total courses for teacher ${teacherId}`);
      console.log('courses/list API - Course IDs:', courses.map(c => c.id));
      // 自動補齊所有欄位
      const withDefaults = (course: Record<string, unknown>) => ({
        id: course.id,
        name: course.name || '',
        code: course.code || '',
        teachers: course.teachers || [],
        teacherUids: course.teacherUids || [],
        gradeTags: course.gradeTags || [],
        classTimes: course.classTimes || [],
        description: course.description || '',
        location: course.location || '',
        liveStreamURL: course.liveStreamURL || '',
        coverImageURL: course.coverImageURL || '',
        students: course.students || [],
        subjectTag: course.subjectTag || '',
        courseNature: course.courseNature || '',
        teachingMethod: course.teachingMethod || '',
        timeArrangementType: course.timeArrangementType || '依時段安排',
        startDate: course.startDate || '',
        endDate: course.endDate || '',
        status: course.status || '未開課',
        showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : false,
        archived: typeof course.archived === 'boolean' ? course.archived : false,
      });
      return NextResponse.json(courses.map(withDefaults));
    }
    
    console.log('courses/list API - No teacherId provided, returning all courses');
    const snapshot = await query.get();
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // 自動補齊所有欄位
    const withDefaults = (course: Record<string, unknown>) => ({
      id: course.id,
      name: course.name || '',
      code: course.code || '',
      teachers: course.teachers || [],
      teacherUids: course.teacherUids || [],
      gradeTags: course.gradeTags || [],
      classTimes: course.classTimes || [],
      description: course.description || '',
      location: course.location || '',
      liveStreamURL: course.liveStreamURL || '',
      coverImageURL: course.coverImageURL || '',
      students: course.students || [],
      subjectTag: course.subjectTag || '',
      courseNature: course.courseNature || '',
      teachingMethod: course.teachingMethod || '',
      timeArrangementType: course.timeArrangementType || '依時段安排',
      startDate: course.startDate || '',
      endDate: course.endDate || '',
      status: course.status || '未開課',
      showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : false,
      archived: typeof course.archived === 'boolean' ? course.archived : false,
    });
    return NextResponse.json(courses.map(withDefaults));
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 新增 GET 方法，回傳所有課程
export async function GET() {
  try {
    console.log('courses/list API - GET request for debugging');
    const snapshot = await adminDb.collection('courses').get();
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // 自動補齊所有欄位
    const withDefaults = (course: Record<string, unknown>) => ({
      id: course.id,
      name: course.name || '',
      code: course.code || '',
      teachers: course.teachers || [],
      teacherUids: course.teacherUids || [],
      gradeTags: course.gradeTags || [],
      classTimes: course.classTimes || [],
      description: course.description || '',
      location: course.location || '',
      liveStreamURL: course.liveStreamURL || '',
      coverImageURL: course.coverImageURL || '',
      students: course.students || [],
      subjectTag: course.subjectTag || '',
      courseNature: course.courseNature || '',
      teachingMethod: course.teachingMethod || '',
      timeArrangementType: course.timeArrangementType || '依時段安排',
      startDate: course.startDate || '',
      endDate: course.endDate || '',
      status: course.status || '未開課',
      showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : false,
      archived: typeof course.archived === 'boolean' ? course.archived : false,
    });
    return NextResponse.json(courses.map(withDefaults));
  } catch (error: unknown) {
    let message = '查詢失敗';
    let stack = undefined;
    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    }
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
} 