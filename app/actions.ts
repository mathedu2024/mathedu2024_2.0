'use server';

import { adminDb } from '../services/firebase-admin';

export async function fetchCourses() {
    const snapshot = await adminDb.collection('courses').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function fetchTeachers() {
    const snapshot = await adminDb.collection('users').where('role', '==', 'teacher').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTeacherUids(teacherIds: string[]) {
    const uids: string[] = [];
    for (const teacherId of teacherIds) {
        const doc = await adminDb.collection('users').doc(teacherId).get();
        if (doc.exists) {
            const data = doc.data();
            if (data && data.uid) {
                uids.push(data.uid);
            }
        }
    }
    return uids;
}

