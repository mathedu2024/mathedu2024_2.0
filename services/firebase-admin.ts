import admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    // ...其他設定...
  });
}

if (!admin.apps.length) {
  throw new Error('Firebase admin not initialized. Check FIREBASE_SERVICE_ACCOUNT env variable.');
}

export const adminDb = admin.firestore();
export default admin; 