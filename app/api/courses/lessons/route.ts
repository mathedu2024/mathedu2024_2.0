import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { parse as parseCookie } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    let lessonsSnapshot;
    let fallback = false;
    try {
      lessonsSnapshot = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('order', 'asc')
        .orderBy('date', 'asc')
        .get();
    } catch {
      lessonsSnapshot = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('date', 'desc')
        .get();
      fallback = true;
    }
    let lessons = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (fallback) lessons = lessons.reverse();

    const cookieHeader = req.headers.get('cookie');
    let isStudent = false;
    if (cookieHeader) {
      try {
        const cookies = parseCookie(cookieHeader);
        const sessionRaw = cookies.session;
        if (sessionRaw) {
          const session = JSON.parse(decodeURIComponent(sessionRaw));
          const roles = Array.isArray(session?.role) ? session.role : [session?.role];
          isStudent = roles.includes('student');
        }
      } catch {
        isStudent = false;
      }
    }

    if (isStudent) {
      lessons = lessons
        .filter((lesson) => (lesson as { visibleToStudents?: boolean }).visibleToStudents !== false)
        .map((lesson) => {
        const attachments = Array.isArray((lesson as { attachments?: unknown[] }).attachments)
          ? (lesson as { attachments: unknown[] }).attachments.filter((att) => {
              if (typeof att === 'string') return att.trim() !== '';
              if (att && typeof att === 'object' && 'url' in att) {
                const typed = att as { url?: string; visibleToStudents?: boolean };
                return !!typed.url && typed.visibleToStudents !== false;
              }
              return false;
            })
          : [];
        return { ...lesson, attachments };
      });
    }
    return NextResponse.json(lessons);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 