import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, password } = await req.json();
    
    if (!id || !password) {
      return NextResponse.json({ error: 'Missing user account or password' }, { status: 400 });
    }

    console.log(`API - Attempting to update password for user account: ${id}`);
    
    const snapshot = await adminDb.collection('users').where('account', '==', id).get();

    if (snapshot.empty) {
      console.log(`API - User with account '${id}' not found in 'users' collection.`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Save the plain text password directly
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ password: password });

    console.log(`API - Plain text password updated successfully for user account: ${id} (Doc ID: ${userDoc.id})`);

    return NextResponse.json({
      success: true,
      message: '密碼更新成功'
    });

  } catch (error) {
    console.error('API - Password update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}