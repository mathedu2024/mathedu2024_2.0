import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { adminDb, auth } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    console.log('API - Login endpoint hit');
    const db = adminDb;
    const { account, password, loginType } = await req.json();
    
    const cleanAccount = account ? account.trim() : '';
    const cleanPassword = password ? password.trim() : '';

    if (!cleanAccount || !cleanPassword || !loginType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`API - Attempting login for account: ${cleanAccount} with loginType: ${loginType}`);

    const userQuery = loginType === 'student'
      ? db.collection('student_data').where('account', '==', cleanAccount)
      : db.collection('users').where('account', '==', cleanAccount);

    const querySnapshot = await userQuery.get();

    if (querySnapshot.empty) {
      console.log('API - User not found');
      return NextResponse.json({ error: 'Account not found' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // --- Defensive Role Validation ---
    let roles = [];
    if (loginType === 'student') {
        roles = ['student'];
    } else if (userData.roles && Array.isArray(userData.roles)) {
        roles = userData.roles;
    } else if (userData.role && typeof userData.role === 'string') {
        roles = [userData.role];
    }

    if (roles.length === 0) {
        console.log(`API - [VALIDATION] Login failed for ${cleanAccount}: No valid role found.`);
        return NextResponse.json({ error: 'User has no assigned role' }, { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!roles.includes(loginType)) {
        console.log(`API - [VALIDATION] Role mismatch. User roles: ${roles}, attempted: ${loginType}`);
        return NextResponse.json({ error: 'Role mismatch' }, { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    
    const userRole = roles; // For use in token + response
    // --- End Role Validation ---

    // Password Validation - Plain text comparison
    const storedPassword = userData.password;
    const passwordIsValid = cleanPassword === storedPassword;

    if (!passwordIsValid) {
      console.log('API - Invalid password');
      return NextResponse.json({ error: 'Invalid password' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('API - Password correct, processing...');
    const uid = userDoc.id;

    if (!uid) {
        console.error(`API - User document ${userDoc.id} is missing uid.`);
        throw new Error(`User data is incomplete.`);
    }
    
    // Ensure user exists in Firebase Auth
    try {
        await auth.getUser(uid);
    } catch (e) {
        const error = e as { code?: string };
        // If user does not exist in Firebase Auth, create it
        if (error.code === 'auth/user-not-found') {
            console.log(`API - User ${uid} not found in Firebase Auth. Creating...`);
            if (!userData.name) {
                throw new Error(`User data is incomplete for auth creation.`);
            }
            await auth.createUser({
                uid: uid,
                displayName: userData.name,
            });
        } else {
            throw e; // Re-throw other auth errors
        }
    }

    const customToken = await auth.createCustomToken(uid, { role: userRole });

    const responseData = {
      token: customToken,
      role: userRole,
      name: userData.name,
      id: userDoc.id,
      account: cleanAccount,
    };

    const sessionData = {
      id: userDoc.id,
      name: userData.name,
      role: userRole,
      account: cleanAccount,
    };

    const cookie = serialize('session', encodeURIComponent(JSON.stringify(sessionData)), {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: 'strict',
    });

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('--- UNCAUGHT ERROR IN LOGIN API ---');
    console.error(error);
    console.error('------------------------------------');
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}