import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { subMonths } from 'date-fns';
import { TutoringSlot, Appointment } from './interfaces'; // Import interfaces

export const TUTORING_RETENTION_MONTHS = 3;
const FIRESTORE_BATCH_LIMIT = 500;

class TutoringService {
  private slotsCollection = adminDb.collection('tutoringSlots');

  private getSlotEndDateTime(slot: Pick<TutoringSlot, 'date' | 'endTime'>): Date {
    const dateStr = (slot.date || '').split('T')[0];
    const endTime = slot.endTime || '23:59';
    return new Date(`${dateStr}T${endTime}`);
  }

  private getRetentionCutoff(): Date {
    return subMonths(new Date(), TUTORING_RETENTION_MONTHS);
  }

  private isWithinRetention(slot: Pick<TutoringSlot, 'date' | 'endTime'>): boolean {
    return this.getSlotEndDateTime(slot) >= this.getRetentionCutoff();
  }

  /** 刪除超過保留期限的輔導時段（含預約紀錄） */
  async purgeExpiredTutoringData(): Promise<number> {
    const cutoff = this.getRetentionCutoff();
    const snapshot = await this.slotsCollection.get();
    const docsToDelete = snapshot.docs.filter((doc) => {
      const slotData = doc.data() as TutoringSlot;
      return this.getSlotEndDateTime(slotData) < cutoff;
    });

    if (docsToDelete.length === 0) return 0;

    for (let i = 0; i < docsToDelete.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = adminDb.batch();
      const chunk = docsToDelete.slice(i, i + FIRESTORE_BATCH_LIMIT);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return docsToDelete.length;
  }

  async createTimeSlot(slot: TutoringSlot): Promise<string> {
    const teacherRef = adminDb.collection('users').doc(slot.teacherId);
    const teacherDoc = await teacherRef.get();

    if (!teacherDoc.exists) {
      throw new Error('Invalid teacherId');
    }

    const teacherData = teacherDoc.data();

    const newSlot = {
      ...slot,
      available: true,
      teacherName: teacherData?.name || 'Unknown',
      bookedStudents: [], // Initialize bookedStudents as an empty array
      bookedCount: 0, // Initialize bookedCount to 0
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const docRef = await this.slotsCollection.add(newSlot);
    return docRef.id;
  }

  async bookAppointment(appointment: Appointment): Promise<string> {
    const { slotId, studentId, studentName, studentDisplayId, studentEmail, problemDescription } = appointment;
    const slotRef = this.slotsCollection.doc(slotId);
  
    return adminDb.runTransaction(async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
  
      if (!slotDoc.exists) {
        throw new Error('Time slot not found');
      }
  
      const slotData = slotDoc.data() as TutoringSlot;
      const currentBookedStudents = slotData.bookedStudents || [];
  
      // Ensure participantLimit is defined and is a number
      const participantLimit = typeof slotData.participantLimit === 'number' ? slotData.participantLimit : 1;
  
      if (currentBookedStudents.length >= participantLimit) {
        // Optionally ensure the slot is marked as unavailable
        if (slotData.available) {
          transaction.update(slotRef, { available: false });
        }
        throw new Error('Time slot is full');
      }
  
      if (currentBookedStudents.some(booked => booked.studentId === studentId)) {
        throw new Error('You have already booked this slot');
      }
  
      const newAppointment = {
        studentId,
        studentDisplayId,
        studentName,
        studentEmail,
        problemDescription,
        status: 'confirmed',
        bookingTimestamp: new Date().toISOString(),
      };
  
      const updatedBookedStudents = [...currentBookedStudents, newAppointment];
  
      transaction.update(slotRef, {
        bookedStudents: updatedBookedStudents,
        bookedCount: FieldValue.increment(1),
        available: updatedBookedStudents.length < participantLimit,
        updatedAt: FieldValue.serverTimestamp(),
      });
  
      return slotId;
    });
  }

  async cancelAppointment(slotId: string, studentId: string): Promise<void> {
    const slotRef = this.slotsCollection.doc(slotId);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      throw new Error('Time slot not found');
    }

    const slotData = slotDoc.data() as TutoringSlot;

    const currentBookedStudents = slotData.bookedStudents || [];

    const studentIndex = currentBookedStudents.findIndex(student => student.studentId === studentId);

    if (studentIndex === -1) {
      throw new Error('Student not found in this time slot');
    }

    const updatedBookedStudents = currentBookedStudents.filter(student => student.studentId !== studentId);

    await slotRef.update({
      bookedStudents: updatedBookedStudents,
      bookedCount: FieldValue.increment(-1),
      available: true, // Always set to true when a spot opens up
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async getTeacherAppointments(teacherId: string): Promise<any[]> {
    console.log(`Placeholder for getTeacherAppointments: ${teacherId}`);
    return Promise.resolve([]);
  }

  async getAllTimeSlots(): Promise<TutoringSlot[]> {
    await this.purgeExpiredTutoringData();
    const snapshot = await this.slotsCollection.get();
    return snapshot.docs
      .filter((doc) => this.isWithinRetention(doc.data() as TutoringSlot))
      .map(doc => {
        const data = doc.data() as TutoringSlot;
        const bookedCount = data.bookedStudents ? data.bookedStudents.length : 0;
        const result = {
          id: doc.id,
          ...data,
          bookedCount: bookedCount,
          isFull: bookedCount >= data.participantLimit,
        };
        console.log('getTimeSlots returning slot:', result);
        return result;
      });
  }

  async getTimeSlots(teacherId: string): Promise<TutoringSlot[]> {
    const snapshot = await this.slotsCollection.where('teacherId', '==', teacherId).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TutoringSlot));
  }

  async getStudentAppointments(
    studentId: string,
    dateRange?: { from?: string; to?: string },
  ): Promise<Appointment[]> {
    await this.purgeExpiredTutoringData();
    const allSlotsSnapshot = await this.slotsCollection.get();
    const studentAppointments: Appointment[] = [];
    const now = new Date();

    allSlotsSnapshot.docs.forEach(slotDoc => {
      const slotData = slotDoc.data() as TutoringSlot;
      if (!this.isWithinRetention(slotData)) return;

      const slotDate = (slotData.date || '').split('T')[0];
      const slotEnd = this.getSlotEndDateTime(slotData);
      const isUpcoming = slotEnd > now;

      if (!isUpcoming && dateRange) {
        if (dateRange.from && slotDate < dateRange.from) return;
        if (dateRange.to && slotDate > dateRange.to) return;
      }

      if (slotData.bookedStudents) {
        slotData.bookedStudents.forEach(bookedAppointment => {
          if (bookedAppointment.studentId === studentId) {
            studentAppointments.push({
              id: slotDoc.id, // Use slotDoc.id as the unique key for the appointment
              ...bookedAppointment,
              slotId: slotDoc.id, // Add slotId to the appointment object
              slotDetails: {
                title: slotData.title,
                date: slotData.date,
                startTime: slotData.startTime,
                endTime: slotData.endTime,
                method: slotData.method,
                locationType: slotData.locationType,
                locationDetails: slotData.locationDetails,
                mode: slotData.mode,
                teacherName: slotData.teacherName,
                teacherId: slotData.teacherId, // Added
                participantLimit: slotData.participantLimit, // Added
                available: slotData.available, // Added
              }
            });
          }
        });
      }
    });

    return studentAppointments;
  }

  async deleteTimeSlot(slotId: string): Promise<void> {
    const slotRef = this.slotsCollection.doc(slotId);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      throw new Error('Time slot not found');
    }

    const slotData = slotDoc.data() as TutoringSlot;
    if (slotData.bookedStudents && slotData.bookedStudents.length > 0) {
      throw new Error('Cannot delete a time slot with active appointments');
    }

    await slotRef.delete();
  }
}

export const tutoringService = new TutoringService();