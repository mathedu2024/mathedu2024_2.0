import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing Firebase Admin SDK environment variables');
    }

    // Ensure proper formatting of the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    // Handle different formats of private key
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const serviceAccount: admin.ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
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
