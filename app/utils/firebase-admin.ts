import * as admin from 'firebase-admin';

// 防止在開發環境中 Hot Reload 導致重複初始化
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  } else {
    console.error('Firebase Admin initialization failed: Missing environment variables');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();