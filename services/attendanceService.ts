import { adminDb as db } from './firebase-admin';
import * as admin from 'firebase-admin';

// Base student data structure
interface Student {
  id: string;
  name: string;
  studentId: string; // 學號
}

// Roster-specific student data structure
export interface RosterStudent {
  id: string;
  name: string;
  studentId: string; // 學號
  status: 'present' | 'absent' | 'leave';
  leaveType?: '事假' | '病假' | '公假' | '喪假' | '身心調適假' | '心理假' | '其他';
  remarks?: string;
}

// Helper to get all students for a given courseId
async function getStudentsForCourse(courseId: string): Promise<Student[]> {
  try {
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) throw new Error('Course not found');

    const studentsSnapshot = await courseDoc.ref.collection('students').get();
    const students = studentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'N/A',
        studentId: data.studentId || 'N/A',
      };
    });

    return students;
  } catch (error) {
    console.error(`Error fetching students for course ${courseId}:`, error);
    throw new Error('Failed to get students for course.');
  }
}

/**
 * Gets the complete attendance roster for a specific activity.
 * @param courseId The ID of the course.
 * @param activityId The ID of the attendance activity.
 * @returns A promise that resolves to an array of RosterStudent objects.
 */
export async function getAttendanceRoster(courseId: string, activityId: string): Promise<RosterStudent[]> {
  try {
    const rosterRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId).collection('roster');
    const rosterSnapshot = await rosterRef.get();

    const roster: RosterStudent[] = rosterSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        studentId: data.studentId,
        status: data.status,
        remarks: data.remarks,
        leaveType: data.leaveType || undefined, // Include leaveType if it exists
      };
    });

    return roster;

  } catch (error) {
    console.error(`Error getting attendance roster for activity ${activityId}:`, error);
    throw new Error('Failed to get attendance roster.');
  }
}

/**
 * Updates the entire attendance roster for an activity based on the provided roster data.
 * @param courseId The ID of the course.
 * @param activityId The ID of the attendance activity.
 * @param roster The full roster data with the latest statuses.
 */
export async function updateAttendanceRoster(courseId: string, activityId: string, roster: RosterStudent[]): Promise<void> {
  try {
    const rosterRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId).collection('roster');
    const batch = db.batch();

    roster.forEach(student => {
      const studentRef = rosterRef.doc(student.id);
      const updatePayload: { [key: string]: any } = {
        studentId: student.studentId,
        name: student.name,
        status: student.status,
        remarks: student.remarks || '',
      };

      if (student.status === 'leave') {
        updatePayload.leaveType = student.leaveType || '其他';
      } else {
        // Explicitly delete leaveType if status is not 'leave'
        updatePayload.leaveType = admin.firestore.FieldValue.delete();
      }
      batch.update(studentRef, updatePayload);
    });

    await batch.commit();
    console.log(`Successfully updated roster for activity ${activityId}`);

  } catch (error) {
    console.error(`Error updating attendance roster for activity ${activityId}:`, error);
    throw new Error('Failed to update attendance roster.');
  }
}

/**
 * Updates a specific attendance activity in Firestore.
 * @param courseId The ID of the course.
 * @param activityId The ID of the activity to update.
 * @param data The data to update.
 */
export async function updateAttendanceActivity(courseId: string, activityId: string, data: Partial<AttendanceActivityData>): Promise<void> {
  try {
    const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);

    const { creationMode, ...updateData } = data;
    const payload: { [key: string]: any } = { ...updateData };

    if (updateData.startTime) {
      payload.startTime = admin.firestore.Timestamp.fromDate(new Date(updateData.startTime));
    }
    if (updateData.endTime) {
      payload.endTime = admin.firestore.Timestamp.fromDate(new Date(updateData.endTime));
    }

    await activityRef.update(payload);
    console.log(`Successfully updated activity ${activityId}`);

  } catch (error) {
    console.error(`Error updating activity ${activityId}:`, error);
    throw new Error('Failed to update activity.');
  }
}

async function deleteCollection(collectionRef: admin.firestore.CollectionReference, batchSize: number) {
  const query = collectionRef.limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query: admin.firestore.Query, resolve: (value: unknown) => void) {
  const snapshot = await query.get();
  if (snapshot.size === 0) {
    resolve(0);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

/**
 * Deletes an attendance activity and all its sub-collections.
 * @param courseId The ID of the course.
 * @param activityId The ID of the activity to delete.
 */
export async function deleteAttendanceActivity(courseId: string, activityId: string): Promise<void> {
  try {
    const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);

    const attendeesRef = activityRef.collection('attendees');
    const leaveRequestsRef = activityRef.collection('leave_requests');

    await Promise.all([
      deleteCollection(attendeesRef, 100),
      deleteCollection(leaveRequestsRef, 100),
    ]);

    await activityRef.delete();
    console.log(`Successfully deleted activity ${activityId} and its sub-collections.`);

  } catch (error) {
    console.error(`Error deleting activity ${activityId}:`, error);
    throw new Error('Failed to delete activity.');
  }
}

export interface ActivitySummary {
  id: string;
  title: string;
  date: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
}

export interface StudentSummary {
  id: string;
  name: string;
  studentId: string;
}

export interface CourseAttendanceSummary {
  students: StudentSummary[];
  activities: ActivitySummary[];
  summary: Record<string, Record<string, { status: string; remarks?: string }>>;
}

export async function getCourseAttendanceSummary(courseId: string): Promise<CourseAttendanceSummary> {
  try {
    const [students, activitiesSnapshot] = await Promise.all([
      getStudentsForCourse(courseId),
      db.collection('courses').doc(courseId).collection('attendance').get(),
    ]);

    const studentSummary: StudentSummary[] = students.map(s => ({ id: s.id, name: s.name, studentId: s.studentId }));
    const activitySummary: ActivitySummary[] = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      date: new Date(doc.data().startTime.toMillis()).toLocaleDateString(),
      presentCount: 0, // Will be calculated later
      absentCount: 0,  // Will be calculated later
      leaveCount: 0,    // Will be calculated later
    }));

    const summary: CourseAttendanceSummary['summary'] = {};
    for (const student of studentSummary) {
      summary[student.id] = {};
      for (const activityDoc of activitiesSnapshot.docs) {
        const activityId = activityDoc.id;
        const rosterDoc = await db.collection('courses').doc(courseId).collection('attendance').doc(activityId).collection('roster').doc(student.id).get();

        if (rosterDoc.exists) {
          const data = rosterDoc.data();
          summary[student.id][activityId] = { status: data.status, remarks: data.remarks };
        } else {
          summary[student.id][activityId] = { status: 'absent' };
        }
      }
    }

    // Calculate aggregated counts for each activity
    const activitiesWithCounts = await Promise.all(activitiesSnapshot.docs.map(async (activityDoc) => {
      const activityId = activityDoc.id;
      const rosterSnapshot = await db.collection('courses').doc(courseId).collection('attendance').doc(activityId).collection('roster').get();
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;

      rosterSnapshot.docs.forEach(rosterDoc => {
        const data = rosterDoc.data();
        if (data.status === 'present') {
          presentCount++;
        } else if (data.status === 'absent') {
          absentCount++;
        } else if (data.status === 'leave') {
          leaveCount++;
        }
      });

      return {
        id: activityDoc.id,
        title: activityDoc.data().title,
        date: new Date(activityDoc.data().startTime.toMillis()).toLocaleDateString(),
        presentCount,
        absentCount,
        leaveCount,
      };
    }));

    return { students: studentSummary, activities: activitiesWithCounts, summary };

  } catch (error) {
    console.error(`Error getting course attendance summary for ${courseId}:`, error);
    throw new Error('Failed to generate attendance summary.');
  }
}

interface AttendanceActivityData {
  courseId: string;
  teacherId: string;
  title: string;
  checkInMethod: 'manual' | 'numeric';
  startTime: Date;
  endTime: Date;
  gracePeriodMinutes: number;
  creationMode?: 'instant' | 'scheduled';
  roster?: any[]; // Add optional roster
}

interface CheckInData {
    courseId: string; // Added courseId
    activityId: string;
    studentId: string;
    checkInCode: string;
}

export async function createAttendanceActivity(data: AttendanceActivityData): Promise<{ activityId: string; checkInCode: string | null; }> {
  try {
    const { courseId, roster, ...activityData } = data;
    let checkInCode: string | null = null;
    let status = 'scheduled';

    if (data.creationMode === 'instant' && data.checkInMethod === 'numeric') {
      checkInCode = Math.floor(100000 + Math.random() * 900000).toString();
      status = 'active';
    } else if (data.checkInMethod === 'manual') {
      status = 'active';
    }

    const activityPayload = {
      ...activityData,
      courseId, // Keep courseId in the activity doc for collection group queries
      startTime: admin.firestore.Timestamp.fromDate(data.startTime),
      endTime: admin.firestore.Timestamp.fromDate(data.endTime),
      status,
      checkInCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    delete activityPayload.creationMode;

    const courseAttendanceRef = db.collection('courses').doc(courseId).collection('attendance');
    const docRef = await courseAttendanceRef.add(activityPayload);

    // Use the provided roster if it exists, otherwise fetch it.
    const studentsToProcess = roster && roster.length > 0 ? roster : await getStudentsForCourse(courseId);

    const rosterRef = docRef.collection('roster');
    const batch = db.batch();
    studentsToProcess.forEach(student => {
      const studentDocId = student.id; 
      if (!studentDocId) {
        console.warn(`Skipping student with missing studentId: ${student.name}`);
        return;
      }
      const studentRef = rosterRef.doc(studentDocId);
      batch.set(studentRef, {
        studentId: student.studentId, // This is the school-specific student number
        name: student.name,
        status: student.status || 'absent', // Use status from roster or default to 'absent'
        remarks: student.remarks || '',
      });
    });
    await batch.commit();
    
    console.log(`Attendance activity created with ID: ${docRef.id} in course ${courseId}. Code: ${checkInCode}`);
    return { activityId: docRef.id, checkInCode };

  } catch (error) {
    console.error('Error creating attendance activity:', error);
    throw new Error('Failed to create attendance activity.');
  }
}

/**
 * Starts an attendance activity, setting its status to 'active' and generating a check-in code.
 * @param courseId The ID of the course.
 * @param activityId The ID of the activity to start.
 * @returns The generated 6-digit check-in code.
 */
export async function startAttendanceActivity(courseId: string, activityId: string): Promise<string> {
    try {
        const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
        
        const checkInCode = Math.floor(100000 + Math.random() * 900000).toString();

        await activityRef.update({
            status: 'active',
            checkInCode: checkInCode,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Activity ${activityId} in course ${courseId} started with code ${checkInCode}`);
        return checkInCode;
    } catch (error) {
        console.error('Error starting attendance activity:', error);
        throw new Error('Failed to start attendance activity.');
    }
}

/**
 * Submits a student's check-in using a Firestore transaction.
 * @param data The check-in data containing courseId, activityId, studentId, and the code.
 * @returns A string indicating the result, e.g., 'present' or 'late'.
 */
export async function submitCheckIn(data: CheckInData): Promise<string> {
    const { courseId, activityId, studentId, checkInCode } = data;

    try {
        const status = await db.runTransaction(async (transaction) => {
            const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
            const studentAttendanceRef = activityRef.collection('attendees').doc(studentId);
            const studentProfileRef = db.collection('student_data').doc(studentId);

            // 1. All reads must come first
            const activityDoc = await transaction.get(activityRef);
            const studentAttendanceDoc = await transaction.get(studentAttendanceRef);
            const studentDoc = await transaction.get(studentProfileRef);

            // 2. All checks must come after reads
            if (!activityDoc.exists) {
                throw new Error('點名活動不存在。');
            }
            if (studentAttendanceDoc.exists) {
                throw new Error('您已經簽到過了。');
            }
            if (!studentDoc.exists) {
                throw new Error('學生資料不存在。');
            }

            // 3. Get data from docs
            const activityData = activityDoc.data() as any;
            const studentData = studentDoc.data();
            const studentName = studentData?.name || '未知學生';
            const studentActualId = studentData?.studentId || studentId; // Use actual studentId from doc if available

            const rosterStudentRef = activityRef.collection('roster').doc(studentId);

            // 5. Business logic checks
            if (activityData.status !== 'active') {
                throw new Error('點名活動尚未開始或已結束。');
            }

            if (activityData.checkInCode !== checkInCode) {
                throw new Error('簽到碼錯誤。');
            }

            const now = new Date();
            const startTime = (activityData.startTime as admin.firestore.Timestamp).toDate();
            const gracePeriodEnd = new Date(startTime.getTime() + (activityData.gracePeriodMinutes || 0) * 60000);

            let attendanceStatus = 'present';
            if (now > gracePeriodEnd) {
                attendanceStatus = 'late';
            }

            // 6. All writes must come last
            transaction.update(activityRef, {
                presentStudentIds: admin.firestore.FieldValue.arrayUnion(studentId),
                presentCount: admin.firestore.FieldValue.increment(1)
            });

            transaction.set(studentAttendanceRef, {
                studentId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: attendanceStatus,
            });

            transaction.set(rosterStudentRef, {
                studentId: studentActualId,
                name: studentName,
                status: attendanceStatus,
            }, { merge: true });

            return attendanceStatus;
        });

        return status;
    } catch (error) {
        console.error('Error submitting check-in:', error);
        throw error;
    }
}

/**
 * Gets the currently active attendance activity for a specific course.
 * @param courseId The ID of the course.
 * @returns An object with activity details or null if no active activity is found.
 */
export async function getActiveActivityForCourse(courseId: string): Promise<{ id: string; title: string; checkInMethod: string; } | null> {
    try {
        const querySnapshot = await db
            .collection('courses').doc(courseId).collection('attendance')
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return null;
        }

        const activityDoc = querySnapshot.docs[0];
        const activityData = activityDoc.data() as any;

        return {
            id: activityDoc.id,
            title: activityData.title,
            checkInMethod: activityData.checkInMethod,
        };
    } catch (error) {
        console.error('Error fetching active activity for course:', error);
        throw new Error('Failed to fetch active activity.');
    }
}

export interface AttendanceActivity {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'active' | 'completed';
    checkInMethod: 'manual' | 'numeric';
    checkInCode?: string | null;
    expected: number;
    present: number;
    absent: number;
    leave: number;
}

async function getCourseStudentCount(courseId: string): Promise<number> {
  try {
    const studentsRef = db.collection('courses').doc(courseId).collection('students');
    const snapshot = await studentsRef.get();
    
    console.log(`Course ${courseId} has ${snapshot.size} students`);
    return snapshot.size;
  } catch (error) {
    console.error(`Error getting student count for course ${courseId}:`, error);
    return 0;
  }
}

/**
 * Gets all attendance activities for a specific course, including attendance stats.
 * @param courseId The ID of the course.
 * @returns An array of activity details with statistics.
 */
export async function getActivitiesForCourse(courseId: string): Promise<AttendanceActivity[]> {
    try {
        const expectedCount = await getCourseStudentCount(courseId);

        const querySnapshot = await db
            .collection('courses').doc(courseId).collection('attendance')
            .orderBy('startTime', 'asc')
            .get();

        if (querySnapshot.empty) {
            return [];
        }

        const activitiesPromises = querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            if (!data) {
                console.warn(`Skipping malformed attendance activity document with ID: ${doc.id}. Data is null/undefined.`);
                return null;
            }

            if (!data.title || !data.startTime || !data.endTime || !data.status || !data.checkInMethod) {
                console.warn(`Skipping malformed attendance activity document with ID: ${doc.id}. Missing essential fields.`, data);
                return null;
            }

            const rosterSnapshot = await doc.ref.collection('roster').get();
            let presentCount = 0;
            let absentCount = 0;
            let leaveCount = 0;

            rosterSnapshot.docs.forEach(rosterDoc => {
              const rosterData = rosterDoc.data();
              if (rosterData.status === 'present') {
                presentCount++;
              } else if (rosterData.status === 'absent') {
                absentCount++;
              } else if (rosterData.status === 'leave') {
                leaveCount++;
              }
            });

            return {
                id: doc.id,
                title: data.title,
                startTime: (data.startTime instanceof admin.firestore.Timestamp) ? data.startTime.toDate().toISOString() : new Date(data.startTime).toISOString(),
                endTime: (data.endTime instanceof admin.firestore.Timestamp) ? data.endTime.toDate().toISOString() : new Date(data.endTime).toISOString(),
                status: data.status,
                checkInMethod: data.checkInMethod,
                checkInCode: data.checkInCode || null,
                expected: expectedCount,
                present: presentCount,
                absent: absentCount,
                leave: leaveCount,
            };
        });

        const activities = (await Promise.all(activitiesPromises)).filter(Boolean) as AttendanceActivity[];

        return activities;
    } catch (error) {
        console.error('Error fetching activities for course:', error);
        throw error;
    }
}