import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/firebase-admin'; // 使用相對路徑解決 TypeScript 找不到模組的問題

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();

    if (!courseId) {
      return NextResponse.json({ error: '缺少課程 ID' }, { status: 400 });
    }

    // 1. 取得課程的成績設定與欄位定義
    // 假設成績資料儲存在 'grades' 集合中，以 courseId 為文件 ID
    const gradeDocRef = db.collection('grades').doc(courseId);
    const gradeDoc = await gradeDocRef.get();

    let gradeData = {
      columnDetails: {},
      regularColumns: 0,
      settings: {
        percents: { quiz: 40, hw: 40, att: 20, periodic: 50 },
        calcModes: { 
          '小考': { mode: 'all', n: 3 }, 
          '作業': { mode: 'all', n: 3 }, 
          '上課態度': { mode: 'all', n: 3 } 
        },
        periodicEnabled: { '第一次定期評量': true, '第二次定期評量': true, '期末評量': true }
      }
    };

    if (gradeDoc.exists) {
      const data = gradeDoc.data();
      gradeData = {
        ...gradeData,
        ...data,
      };
    }

    // 2. 取得該課程的學生名單
    // 參考專案中的 course-student-list 邏輯
    const studentsSnapshot = await db.collection('course-student-list')
      .where('courseId', '==', courseId)
      .get();

    const students = studentsSnapshot.docs.map(doc => {
      const data = doc.data();
      // 這裡需要合併該學生在課程中的分數紀錄
      // 假設分數存在學生文件下或獨立集合，這裡進行合併
      return {
        id: doc.id,
        studentId: data.studentId || '',
        name: data.name || '',
        grade: data.grade || '',
        regularScores: data.regularScores || {},
        periodicScores: data.periodicScores || {},
        manualAdjust: data.manualAdjust || 0
      };
    });

    return NextResponse.json({ ...gradeData, students });

  } catch (error) {
    console.error('讀取成績失敗:', error);
    return NextResponse.json({ error: '伺服器內部錯誤' }, { status: 500 });
  }
}