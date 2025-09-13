import { NextRequest, NextResponse } from 'next/server';

import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, password } = await req.json();
    
    if (!id || !password) {
      return NextResponse.json({ error: 'Missing id or password' }, { status: 400 });
    }

    console.log(`API - Attempting to update password for user: ${id}`);
    console.log(`API - Looking in users collection for account: ${id}`);
    
    let updated = false;
    let updatedCollection = '';
    let updatedDocId = '';

    // First try to find by document ID in users collection
    try {
      const docRef = adminDb.collection('users').doc(id);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({ password });
        updated = true;
        updatedCollection = 'users';
        updatedDocId = id;
        console.log(`API - Password updated for user ${id} by document ID in users collection`);
      }
    } catch (error) {
      console.log(`API - Document ID lookup failed for ${id}:`, error);
    }

    // If not found by document ID, try by account field
    if (!updated) {
      console.log(`API - Trying to find by account field: ${id}`);
      const snapshot = await adminDb.collection('users').where('account', '==', id).get();
      if (!snapshot.empty) {
        const uid = snapshot.docs[0].id;
        await adminDb.collection('users').doc(uid).update({ password });
        updated = true;
        updatedCollection = 'users';
        updatedDocId = uid;
        console.log(`API - Password updated for user ${id} by account field in users collection`);
      }
    }

    // If still not found, try other possible fields
    if (!updated) {
      const possibleFields = ['username', 'user', 'email'];
      for (const field of possibleFields) {
        const snapshot = await adminDb.collection('users').where(field, '==', id).get();
        if (!snapshot.empty) {
          const uid = snapshot.docs[0].id;
          await adminDb.collection('users').doc(uid).update({ password });
          updated = true;
          updatedCollection = 'users';
          updatedDocId = uid;
          console.log(`API - Password updated for user ${id} by ${field} field in users collection`);
          break;
        }
      }
    }

    // Try admin-teachers collection as fallback
    if (!updated) {
      console.log(`API - Trying admin-teachers collection for: ${id}`);
      const possibleFields = ['account', 'username', 'user', 'email'];
      for (const field of possibleFields) {
        const snapshot = await adminDb.collection('admin-teachers').where(field, '==', id).get();
        if (!snapshot.empty) {
          const uid = snapshot.docs[0].id;
          await adminDb.collection('admin-teachers').doc(uid).update({ password });
          updated = true;
          updatedCollection = 'admin-teachers';
          updatedDocId = uid;
          console.log(`API - Password updated for user ${id} in admin-teachers collection`);
          break;
        }
      }
    }

    if (updated) {
      return NextResponse.json({ 
        success: true, 
        collection: updatedCollection, 
        docId: updatedDocId,
        message: '密碼更新成功'
      });
    } else {
      console.log(`API - User not found in any collection: ${id}`);
      
      // Debug: List all users to see what's available
      const allUsers = await adminDb.collection('users').get();
      console.log(`API - Available users:`, allUsers.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('API - Password update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 