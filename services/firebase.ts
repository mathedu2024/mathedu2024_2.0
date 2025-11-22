import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration, using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App (prevent re-initialization)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with settings for performance and offline persistence
// This modern approach combines initialization and settings in one step.
const db = initializeFirestore(app, {
  // Use persistent cache with unlimited size for best performance and offline support.
  // This helps avoid re-downloading data that is already on the device.
  cache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager()
  })
} as any);

// Initialize other Firebase services
const storage = getStorage(app);
const auth = getAuth(app);

console.log('Firebase client initialized with optimized settings.');

export { db, storage, auth };
