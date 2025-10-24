

import * as admin from 'firebase-admin';
import * as path from 'path';

declare global {
  var _firebaseAdmin: {
    db: admin.firestore.Firestore;
    auth: admin.auth.Auth;
  }
}

if (!global._firebaseAdmin) {
  try {
    console.log("Initializing Firebase Admin SDK...");
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          databaseURL: `https://${projectId}.firebaseio.com`,
        });
      } else {
        const serviceAccountPath = path.join(process.cwd(), 'services', 'serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
          databaseURL: 'https://mathedu2024-f0b01.firebaseio.com',
        });
      }
      console.log('Firebase Admin SDK initialized successfully.');
    }
    global._firebaseAdmin = {
      db: admin.firestore(),
      auth: admin.auth(),
    };
  } catch (error) {
    console.error('!!! CRITICAL: FIREBASE ADMIN SDK INITIALIZATION FAILED !!!', error);
    throw error;
  }
}

export const adminDb = global._firebaseAdmin.db;
export const auth = global._firebaseAdmin.auth;
