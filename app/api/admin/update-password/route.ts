import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const { id, password } = await req.json();
  // TODO: session 驗證與權限檢查
  if (!id || !password) return NextResponse.json({ error: 'Missing id or password' }, { status: 400 });

  const possibleFields = ['account', 'username', 'user', 'email'];
  let updated = false;
  let updatedCollection = '';
  let updatedDocId = '';

  // users where
  for (const field of possibleFields) {
    const snapshot = await adminDb.collection('users').where(field, '==', id).get();
    if (!snapshot.empty) {
      const uid = snapshot.docs[0].id;
      await adminDb.collection('users').doc(uid).set({ password }, { merge: true });
      updated = true;
      updatedCollection = 'users';
      updatedDocId = uid;
      break;
    }
  }

  // admin-teachers where
  if (!updated) {
    for (const field of possibleFields) {
      const snapshot = await adminDb.collection('admin-teachers').where(field, '==', id).get();
      if (!snapshot.empty) {
        const uid = snapshot.docs[0].id;
        await adminDb.collection('admin-teachers').doc(uid).set({ password }, { merge: true });
        updated = true;
        updatedCollection = 'admin-teachers';
        updatedDocId = uid;
        break;
      }
    }
  }

  if (updated) {
    return NextResponse.json({ success: true, collection: updatedCollection, docId: updatedDocId });
  } else {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
} 