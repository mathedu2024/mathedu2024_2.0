import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const id = data.id || Date.now().toString();
    
    console.log('=== 課程建立 API 開始 ===');
    console.log('收到的資料:', JSON.stringify(data, null, 2));
    console.log('課程 ID:', id);
    
    // 驗證必要欄位
    if (!data.name || !data.code) {
      console.error('缺少必要欄位: name 或 code');
      return NextResponse.json({ 
        error: '缺少必要欄位: 課程名稱或課程代碼' 
      }, { status: 400 });
    }
    
    if (!('startDate' in data)) data.startDate = '';
    if (!('endDate' in data)) data.endDate = '';
    
    // 準備寫入資料庫的資料
    const courseData = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('準備寫入資料庫的資料:', JSON.stringify(courseData, null, 2));
    
    // 創建課程
    console.log('開始寫入 Firestore...');
    const docRef = adminDb.collection('courses').doc(id);
    await docRef.set(courseData, { merge: true });
    console.log('課程寫入成功！Document ID:', id);
    
    // 驗證寫入是否成功
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      console.error('寫入後無法讀取文件，可能寫入失敗');
      return NextResponse.json({ 
        error: '課程寫入失敗，請稍後再試' 
      }, { status: 500 });
    }
    
    console.log('文件驗證成功，課程已存在於資料庫');
    
    // 如果指定了老師，同步更新老師的授課清單
    if (data.teachers && Array.isArray(data.teachers) && data.teachers.length > 0) {
      try {
        const courseKey = `${data.name}(${data.code})`;
        console.log('開始同步老師授課清單，課程鍵值:', courseKey);
        
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
                
                console.log(`已將課程 ${courseKey} 加入老師 ${teacherId} 的授課清單`);
              } else {
                console.log(`課程 ${courseKey} 已存在於老師 ${teacherId} 的授課清單中`);
              }
            } else {
              console.log(`找不到老師 ${teacherId} 的資料`);
            }
          } catch (error) {
            console.error(`更新老師 ${teacherId} 授課清單時發生錯誤:`, error);
          }
        }
      } catch (error) {
        console.error('同步老師課程時發生錯誤:', error);
      }
    }
    
    console.log('=== 課程建立 API 完成 ===');
    return NextResponse.json({ success: true, id });
    
  } catch (error) {
    console.error('=== 課程建立 API 錯誤 ===');
    console.error('錯誤詳情:', error);
    console.error('錯誤訊息:', (error as any).message);
    console.error('錯誤堆疊:', (error as any).stack);
    
    return NextResponse.json({ 
      error: (error as any).message || '創建課程失敗',
      details: (error as any).stack || '未知錯誤'
    }, { status: 500 });
  }
} 