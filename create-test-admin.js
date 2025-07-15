// 建立測試管理員帳號腳本
// 請在 Firebase Console 中執行此腳本，或使用 Firebase Admin SDK

const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK（請替換為您的服務帳號金鑰）
// const serviceAccount = require('./path-to-your-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// 測試管理員帳號資訊
const testAdmin = {
  account: 'admin',
  password: 'admin123',
  name: '系統管理員',
  role: 'admin',
  email: 'admin@test.com',
  phone: '0912345678',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// 建立管理員帳號的函數
async function createTestAdmin() {
  try {
    const db = admin.firestore();
    
    // 在 users 集合中建立管理員帳號
    const userRef = db.collection('users').doc(testAdmin.account);
    await userRef.set({
      account: testAdmin.account,
      password: testAdmin.password, // 注意：實際應用中應該加密
      name: testAdmin.name,
      role: testAdmin.role,
      email: testAdmin.email,
      phone: testAdmin.phone,
      createdAt: testAdmin.createdAt,
      updatedAt: testAdmin.updatedAt
    });
    
    console.log('✅ 測試管理員帳號建立成功！');
    console.log('📋 帳號資訊：');
    console.log(`   用戶名：${testAdmin.account}`);
    console.log(`   密碼：${testAdmin.password}`);
    console.log(`   姓名：${testAdmin.name}`);
    console.log(`   角色：${testAdmin.role}`);
    console.log('');
    console.log('🔗 登入網址：http://localhost:3000/panel');
    console.log('⚠️  注意：請在正式環境中更改密碼！');
    
  } catch (error) {
    console.error('❌ 建立測試帳號失敗：', error);
  }
}

// 執行建立帳號
createTestAdmin(); 