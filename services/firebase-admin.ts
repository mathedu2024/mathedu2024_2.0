import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount: admin.ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

const adminDb = admin.firestore();
const auth = admin.auth();

export { adminDb, auth };
