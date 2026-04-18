

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

declare global {
  var _firebaseAdmin: {
    db: admin.firestore.Firestore;
    auth: admin.auth.Auth;
    initError?: string;
  } | undefined;
}

if (!global._firebaseAdmin) {
  let db: admin.firestore.Firestore | undefined;
  let firebaseAuth: admin.auth.Auth | undefined;
  let initError: string | undefined;

  try {
    console.log('Initializing Firebase Admin SDK...');
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
        if (fs.existsSync(serviceAccountPath)) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
            databaseURL: 'https://mathedu2024-f0b01.firebaseio.com',
          });
        } else {
          throw new Error('Firebase Admin initialization failed: missing FIREBASE_* env vars and services/serviceAccountKey.json');
        }
      }
      console.log('Firebase Admin SDK initialized successfully.');
    }

    db = admin.firestore();
    firebaseAuth = admin.auth();
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error('!!! CRITICAL: FIREBASE ADMIN SDK INITIALIZATION FAILED !!!', error);
  }

  global._firebaseAdmin = {
    db: (db ?? (new Proxy({}, {
      get() {
        throw new Error(initError || 'Firebase Admin DB unavailable');
      },
    }) as unknown as admin.firestore.Firestore)),
    auth: (firebaseAuth ?? (new Proxy({}, {
      get() {
        throw new Error(initError || 'Firebase Admin Auth unavailable');
      },
    }) as unknown as admin.auth.Auth)),
    initError,
  };
}

export const adminDb = global._firebaseAdmin.db;
export const auth = global._firebaseAdmin.auth;
