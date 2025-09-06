import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing Firebase Admin SDK environment variables');
    }

    // Ensure proper formatting of the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Handle different formats of private key
    if (privateKey) {
      // Remove quotes if they exist at the beginning and end
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Always replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // Ensure the key has proper PEM format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('Firebase Admin SDK Error: Private key does not have proper PEM format');
        console.error('Please check your environment variables and ensure the private key is correctly formatted');
      }
    } else {
      console.error('Firebase Admin SDK Error: Private key is undefined');
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
