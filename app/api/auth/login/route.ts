import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { serialize } from 'cookie';

// Initialize Firebase Admin SDK
// We move this inside the POST handler to ensure env variables are loaded.
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    // Log environment variables for debugging right before initialization
    console.log('--- Initializing Firebase Admin ---');
    console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('FIREBASE_PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);
    console.log('PRIVATE_KEY START:', process.env.FIREBASE_PRIVATE_KEY?.slice(0, 30));
    console.log('PRIVATE_KEY END:', process.env.FIREBASE_PRIVATE_KEY?.slice(-30));
    console.log('------------------------------------');

    const serviceAccount: admin.ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    console.log('privateKey (raw):', JSON.stringify(process.env.FIREBASE_PRIVATE_KEY));
    console.log('privateKey (after replace):', JSON.stringify(serviceAccount.privateKey));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
};

export async function POST(req: NextRequest) {
  console.log('API - Login endpoint hit');
  initializeFirebaseAdmin(); // Ensure Firebase Admin is initialized on each request

  const db = getFirestore();
  const auth = admin.auth();

  // --- Start Debugging --- (This line can be removed now)
  console.log("--- Login API Endpoint Hit ---");
  // --- End Debugging ---

  try {
    console.log('API - Parsing request body...');
    const { account, password, loginType } = await req.json();
    console.log('API - Request data:', { account, password: '***', loginType });
    
    const cleanAccount = account.trim();
    const cleanAccountStr = String(cleanAccount);
    console.log('API - Clean account:', cleanAccountStr);
    
    if (!cleanAccount || !password || !loginType) {
      console.log('API - Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log('API - Querying Firestore...');
    let userDoc;
    let userQuery;
    if (loginType === 'student') {
      userQuery = db.collection('student_data').where('account', '==', cleanAccount);
    } else {
      userQuery = db.collection('users').where('account', '==', cleanAccount);
    }
    const querySnapshot = await userQuery.get();
    console.log('API - Query result empty:', querySnapshot.empty);
    console.log('API - Query result docs count:', querySnapshot.docs.length);
    
    if (!querySnapshot.empty) {
      userDoc = querySnapshot.docs[0];
      console.log('API - User doc found:', userDoc.id);
      console.log('API - User data:', userDoc.data());
    }
    
    if (!userDoc || !userDoc.exists) {
      console.log('API - User not found');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    const userData = userDoc.data();
    console.log('API - Checking password...');
    if (!userData || userData.password !== password) {
      console.log('API - Password mismatch');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    console.log('API - Password correct, processing...');
    let uid = userDoc.id;
    
    // If user does not have a UID, create one in Firebase Auth
    if (!uid) {
      console.log(`API - User ${cleanAccount} does not have a UID. Creating one...`);
      
      // Defensive check for required fields before creating an auth user
      if (!userData.name) {
        console.error(`API - User document ${userDoc.id} is missing 'name' field.`);
        throw new Error(`User data is incomplete for account creation.`);
      }

      const authUser = await auth.createUser({
        uid: userDoc.id,
        displayName: userData.name,
      });
      uid = authUser.uid;
      
      // Save the new UID back to the user document
      await userDoc.ref.update({ uid: uid });
      console.log(`API - Successfully created and linked UID ${uid} for user ${cleanAccount}.`);
    }

    console.log('API - Creating custom token...');
    const customToken = await auth.createCustomToken(uid);
    
    const responseData = { 
      token: customToken,
      role: userData.role || (loginType === 'student' ? 'student' : userData.roles),
      name: userData.name,
      id: userDoc.id,
      account: cleanAccount,
    };
    
    // 新增：設置 HttpOnly session cookie
    const sessionData = {
      id: userDoc.id,
      name: userData.name,
      role: responseData.role,
      account: cleanAccount,
    };
    const cookie = serialize('session', encodeURIComponent(JSON.stringify(sessionData)), {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 1天
      sameSite: 'strict',
    });
    
    console.log('API - Sending response with Set-Cookie:', sessionData);
    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    let message = '登入失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 