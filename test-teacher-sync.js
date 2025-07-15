const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./services/serviceAccountKey.json');

// 初始化 Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const adminDb = getFirestore();

// 模擬課程創建API邏輯
async function createCourse(data) {
  const id = data.id || Date.now().toString();
  
  console.log('courses/create API - Received data:', data);
  
  if (!('startDate' in data)) data.startDate = '';
  if (!('endDate' in data)) data.endDate = '';
  
  // 創建課程
  await adminDb.collection('courses').doc(id).set(data, { merge: true });
  
  // 如果指定了老師，同步更新老師的授課清單
  if (data.teachers && Array.isArray(data.teachers) && data.teachers.length > 0) {
    try {
      const courseKey = `${data.name}(${data.code})`;
      
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
  
  return { success: true, id };
}

// 模擬課程更新API邏輯
async function updateCourse(data) {
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
              const updatedCourses = oldCourses.filter((course) => course !== courseKey);
              
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
  
  return { success: true, id };
}

// 模擬課程刪除API邏輯
async function deleteCourse(id) {
  console.log('courses/delete API - Deleting course:', id);
  
  // 獲取課程資料以取得老師資訊
  const courseDoc = await adminDb.collection('courses').doc(id).get();
  if (!courseDoc.exists) {
    throw new Error('Course not found');
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
          const updatedCourses = currentCourses.filter((course) => course !== courseKey);
          
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
  
  return { success: true };
}

async function testTeacherCourseSync() {
  console.log('開始測試老師課程同步功能...\n');

  try {
    // 1. 創建測試老師
    console.log('1. 創建測試老師...');
    const teacherId = 'test-teacher-' + Date.now();
    await adminDb.collection('users').doc(teacherId).set({
      username: 'testteacher',
      password: 'test123',
      name: '測試老師',
      role: 'teacher',
      email: 'test@example.com',
      courses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ 創建老師成功: ${teacherId}\n`);

    // 2. 創建測試課程（使用API邏輯）
    console.log('2. 創建測試課程...');
    const courseId = '測試課程(2024-TEST-001)';
    await createCourse({
      id: courseId,
      name: '測試課程',
      code: '2024-TEST-001',
      teachers: [teacherId],
      teacherUids: [teacherId],
      status: '未開課',
      gradeTags: ['高一'],
      subjectTag: '數學',
      courseNature: '進度課程',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ 創建課程成功: ${courseId}\n`);

    // 3. 檢查老師的授課清單是否自動更新
    console.log('3. 檢查老師授課清單...');
    const teacherDoc = await adminDb.collection('users').doc(teacherId).get();
    const teacherData = teacherDoc.data();
    console.log(`老師授課清單: ${JSON.stringify(teacherData.courses)}`);
    
    if (teacherData.courses && teacherData.courses.includes(courseId)) {
      console.log('✅ 老師授課清單已自動更新\n');
    } else {
      console.log('❌ 老師授課清單未更新\n');
    }

    // 4. 更新課程（更換老師）
    console.log('4. 測試課程更新...');
    const newTeacherId = 'test-teacher-2-' + Date.now();
    await adminDb.collection('users').doc(newTeacherId).set({
      username: 'testteacher2',
      password: 'test123',
      name: '測試老師2',
      role: 'teacher',
      email: 'test2@example.com',
      courses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await updateCourse({
      id: courseId,
      name: '測試課程',
      code: '2024-TEST-001',
      teachers: [newTeacherId],
      teacherUids: [newTeacherId],
      status: '未開課',
      gradeTags: ['高一'],
      subjectTag: '數學',
      courseNature: '進度課程',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      updatedAt: new Date().toISOString()
    });
    console.log('✅ 課程更新成功\n');

    // 5. 檢查老師授課清單更新
    console.log('5. 檢查老師授課清單更新...');
    const oldTeacherDoc = await adminDb.collection('users').doc(teacherId).get();
    const newTeacherDoc = await adminDb.collection('users').doc(newTeacherId).get();
    
    const oldTeacherData = oldTeacherDoc.data();
    const newTeacherData = newTeacherDoc.data();
    
    console.log(`原老師授課清單: ${JSON.stringify(oldTeacherData.courses)}`);
    console.log(`新老師授課清單: ${JSON.stringify(newTeacherData.courses)}`);
    
    if (!oldTeacherData.courses.includes(courseId) && newTeacherData.courses.includes(courseId)) {
      console.log('✅ 老師授課清單更新成功\n');
    } else {
      console.log('❌ 老師授課清單更新失敗\n');
    }

    // 6. 刪除課程（使用API邏輯）
    console.log('6. 測試課程刪除...');
    await deleteCourse(courseId);
    console.log('✅ 課程刪除成功\n');

    // 7. 檢查老師授課清單是否自動清除
    console.log('7. 檢查老師授課清單清除...');
    const finalTeacherDoc = await adminDb.collection('users').doc(newTeacherId).get();
    const finalTeacherData = finalTeacherDoc.data();
    console.log(`老師授課清單: ${JSON.stringify(finalTeacherData.courses)}`);
    
    if (!finalTeacherData.courses.includes(courseId)) {
      console.log('✅ 老師授課清單已自動清除\n');
    } else {
      console.log('❌ 老師授課清單未清除\n');
    }

    // 8. 清理測試資料
    console.log('8. 清理測試資料...');
    await adminDb.collection('users').doc(teacherId).delete();
    await adminDb.collection('users').doc(newTeacherId).delete();
    console.log('✅ 測試資料清理完成\n');

    console.log('🎉 所有測試完成！');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 執行測試
testTeacherCourseSync(); 