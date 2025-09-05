import admin from 'firebase-admin';

let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
} catch (e) {
  console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

let adminDb: admin.firestore.Firestore;

if (admin.apps.length) {
  adminDb = admin.firestore();
} else {
  console.warn('Firebase admin not initialized. Using a mock Firestore object for build purposes.');
  const mockDb = () => new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'then') {
        return undefined;
      }
      if (prop === 'collection' || prop === 'doc' || prop === 'where' || prop === 'orderBy' || prop === 'limit') {
        return mockDb;
      }
      if (prop === 'batch') {
        return () => ({
            set: () => {},
            update: () => {},
            delete: () => {},
            commit: () => Promise.resolve(),
        });
      }
      return () => Promise.resolve({
        docs: [],
        empty: true,
        exists: false,
        data: () => null,
        id: 'mock-id'
      });
    }
  });
  adminDb = mockDb() as unknown as admin.firestore.Firestore;
}


export { adminDb };
export default admin;