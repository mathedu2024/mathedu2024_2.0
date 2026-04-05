const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// 請填入您的 Service Account Key 路徑
const serviceAccount = require('../service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {
  console.log('Start seeding...');

  // 模擬學生資料
  const students = [
    { id: 's1', name: '王小明', studentId: '11001' },
    { id: 's2', name: '陳小華', studentId: '11002' },
    { id: 's3', name: '張三', studentId: '11003' },
    { id: 's4', name: '李四', studentId: '11004' },
    { id: 's5', name: '王五', studentId: '11005' },
  ];

  // 建立課程資料 (包含學生列表)
  const courses = [
    {
      name: '高一數學 A',
      code: 'MATH101',
      description: '基礎微積分導論',
      students: [students[0], students[1], students[2]]
    },
    {
      name: '高二物理 B',
      code: 'PHYS201',
      description: '力學與熱學',
      students: [students[3], students[4]]
    }
  ];

  for (const course of courses) {
    await db.collection('courses').add(course);
    console.log(`Added course: ${course.name}`);
  }

  console.log('Seeding completed.');
}

main().catch(console.error);