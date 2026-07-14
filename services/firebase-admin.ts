import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { createGuardedFirestore } from './firestoreGuardProxy';

type AdminCreds = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

declare global {
  var _firebaseAdmin: {
    db: admin.firestore.Firestore;
    quizDb: admin.firestore.Firestore;
    auth: admin.auth.Auth;
    initError?: string;
  } | undefined;
  /** 舊版曾為 boolean；執行期需相容 HMR 殘留 */
  var _firestoreSettingsApplied: Set<string> | boolean | undefined;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n');
}

function isUsableCreds(creds: Partial<AdminCreds> | null | undefined): creds is AdminCreds {
  if (!creds?.projectId || !creds.clientEmail || !creds.privateKey) return false;
  const key = normalizePrivateKey(creds.privateKey);
  return (
    key.includes('BEGIN PRIVATE KEY') &&
    key.includes('END PRIVATE KEY') &&
    key.length > 200
  );
}

function readCoreCredsFromEnv(): Partial<AdminCreds> {
  const clientEmail =
    process.env.FIREBASE_CORE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  return {
    projectId: process.env.FIREBASE_CORE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    clientEmail: clientEmail?.trim().replace(/\.+$/, ''),
    privateKey: process.env.FIREBASE_CORE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY,
  };
}

function readQuizCredsFromEnv(): Partial<AdminCreds> {
  return {
    projectId: process.env.FIREBASE_QUIZ_PROJECT_ID?.trim(),
    clientEmail: process.env.FIREBASE_QUIZ_CLIENT_EMAIL?.trim().replace(/\.+$/, ''),
    privateKey: process.env.FIREBASE_QUIZ_PRIVATE_KEY,
  };
}

function applyFirestoreSettings(db: admin.firestore.Firestore, label: string): void {
  // HMR 可能殘留舊版 boolean，需重置為 Set
  if (!(global._firestoreSettingsApplied instanceof Set)) {
    global._firestoreSettingsApplied = new Set();
  }
  if (global._firestoreSettingsApplied.has(label)) return;

  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already been initialized|already initialized/i.test(message)) {
      throw error;
    }
  }

  global._firestoreSettingsApplied.add(label);
}

function initApp(appName: string, creds: AdminCreds): admin.app.App {
  const existing = admin.apps.find((app) => app?.name === appName);
  if (existing) return existing;

  return admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: normalizePrivateKey(creds.privateKey),
      }),
      databaseURL: `https://${creds.projectId}.firebaseio.com`,
    },
    appName
  );
}

function initCoreAppFromServiceAccountFile(): admin.app.App | null {
  const existing = admin.apps.find((app) => app?.name === 'core');
  if (existing) return existing;

  const serviceAccountPath = path.join(process.cwd(), 'services', 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) return null;

  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: 'https://mathedu2024-f0b01.firebaseio.com',
    },
    'core'
  );
}

function unavailableDb(initError?: string): admin.firestore.Firestore {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(initError || 'Firebase Admin DB unavailable');
      },
    }
  ) as unknown as admin.firestore.Firestore;
}

function unavailableAuth(initError?: string): admin.auth.Auth {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(initError || 'Firebase Admin Auth unavailable');
      },
    }
  ) as unknown as admin.auth.Auth;
}

function shouldInitFirebaseAdmin(): boolean {
  if (!global._firebaseAdmin) return true;
  if (global._firebaseAdmin.initError) return true;
  if (!global._firebaseAdmin.quizDb) return true;
  return false;
}

if (shouldInitFirebaseAdmin()) {
  let db: admin.firestore.Firestore | undefined;
  let quizDbInstance: admin.firestore.Firestore | undefined;
  let firebaseAuth: admin.auth.Auth | undefined;
  let initError: string | undefined;

  try {
    console.log('Initializing Firebase Admin SDK (core + quiz)...');

    const coreCreds = readCoreCredsFromEnv();
    let coreApp: admin.app.App | null = null;

    if (isUsableCreds(coreCreds)) {
      coreApp = initApp('core', coreCreds);
    } else {
      coreApp = initCoreAppFromServiceAccountFile();
    }

    if (!coreApp) {
      throw new Error(
        'Firebase Admin (core) initialization failed: missing FIREBASE_CORE_* (or legacy FIREBASE_*) env vars and services/serviceAccountKey.json'
      );
    }

    const rawCoreDb = coreApp.firestore();
    applyFirestoreSettings(rawCoreDb, 'core');
    db = createGuardedFirestore(rawCoreDb);
    firebaseAuth = coreApp.auth();

    const quizCreds = readQuizCredsFromEnv();
    if (isUsableCreds(quizCreds)) {
      const quizApp = initApp('quiz', quizCreds);
      const rawQuizDb = quizApp.firestore();
      applyFirestoreSettings(rawQuizDb, 'quiz');
      quizDbInstance = createGuardedFirestore(rawQuizDb);
      console.log(`Firebase Admin quiz DB ready (project: ${quizCreds.projectId}).`);
    } else {
      quizDbInstance = db;
      console.warn(
        '[firebase-admin] FIREBASE_QUIZ_* not configured; quizDb temporarily uses core DB. Fill FIREBASE_QUIZ_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY to isolate quizzes.'
      );
    }

    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error('!!! CRITICAL: FIREBASE ADMIN SDK INITIALIZATION FAILED !!!', error);
  }

  global._firebaseAdmin = {
    db: db ?? unavailableDb(initError),
    quizDb: quizDbInstance ?? unavailableDb(initError),
    auth: firebaseAuth ?? unavailableAuth(initError),
    initError,
  };
}

/** 主站 Firestore（課程、學生、點名、成績等） */
export const adminDb: admin.firestore.Firestore = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop, receiver) {
    const db = global._firebaseAdmin!.db;
    const value = Reflect.get(db as object, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(db) : value;
  },
});

/** 線上測驗／課程問卷 Firestore（quizzes、quiz_submissions、course_surveys、survey_responses）；未設定 QUIZ 憑證時暫與 adminDb 相同 */
export const quizDb: admin.firestore.Firestore = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop, receiver) {
    const db = global._firebaseAdmin!.quizDb;
    const value = Reflect.get(db as object, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(db) : value;
  },
});

export const auth: admin.auth.Auth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop, receiver) {
    const a = global._firebaseAdmin!.auth;
    const value = Reflect.get(a as object, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(a) : value;
  },
});
