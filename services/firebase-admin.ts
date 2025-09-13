import * as admin from 'firebase-admin';
import * as path from 'path';

if (!admin.apps.length) {
  try {
    console.log("Initializing Firebase Admin SDK...");
    
    // Try to load from environment variables first
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      console.log("Using environment variables for Firebase Admin SDK...");
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
    } else {
      // Fallback to service account key file
      console.log("Using service account key file for Firebase Admin SDK...");
      const serviceAccountPath = path.join(process.cwd(), 'services', 'serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        databaseURL: 'https://mathedu2024-f0b01.firebaseio.com',
      });
    }

    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('!!! CRITICAL: FIREBASE ADMIN SDK INITIALIZATION FAILED !!!');
    console.error('Please check your Firebase configuration and credentials.');
    console.error('Full error:', error);
    throw error; // Re-throw the error to make it visible
  }
}

const adminDb = admin.firestore();
const auth = admin.auth();

export { adminDb, auth };
