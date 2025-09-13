import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    console.log("Initializing Firebase Admin SDK...");
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Debugging logs
    console.log("Checking Firebase Admin credentials...");
    console.log("FIREBASE_PROJECT_ID:", projectId ? "Loaded" : "MISSING");
    console.log("FIREBASE_CLIENT_EMAIL:", clientEmail ? "Loaded" : "MISSING");
    console.log("FIREBASE_PRIVATE_KEY:", privateKey ? "Loaded" : "MISSING");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin SDK credentials are not fully set. Please check your .env.local file and server logs for details.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\n/g, '\n'),
      }),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });

    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('!!! CRITICAL: FIREBASE ADMIN SDK INITIALIZATION FAILED !!!');
    console.error('This is likely due to an invalid private key format in your .env.local file.');
    console.error('Please ensure the FIREBASE_PRIVATE_KEY is a single line, enclosed in double quotes, with newlines escaped as \n.');
    console.error('Full error:', error);
    throw error; // Re-throw the error to make it visible
  }
}

const adminDb = admin.firestore();
const auth = admin.auth();

export { adminDb, auth };
