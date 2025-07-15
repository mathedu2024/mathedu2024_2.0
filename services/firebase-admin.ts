import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

const app = !getApps().length
  ? initializeApp({ credential: cert(serviceAccount) })
  : getApp();

export const adminDb = getFirestore(app); 