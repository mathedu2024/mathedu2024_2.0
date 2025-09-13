import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET() {
  try {
    console.log("Attempting to fetch teacher list from Firestore...");
    const snap = await adminDb.collection('users').where('roles', 'array-contains', 'teacher').get();
    const teachers = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        account: data.account,
        roles: data.roles,
      };
    });
    console.log("Successfully fetched teacher list.");
    return NextResponse.json(teachers);
  } catch (error) {
    console.error("--- ERROR IN /api/teacher/list ---");
    console.error(error);
    console.error("------------------------------------");
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to fetch teacher list.", details: message }, { status: 500 });
  }
} 