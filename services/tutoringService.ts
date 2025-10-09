import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { TutoringSlot, Appointment } from './interfaces'; // Import interfaces

class TutoringService {
  private slotsCollection = adminDb.collection('tutoringSlots');

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
    const snapshot = await this.slotsCollection.get();
    return snapshot.docs.map(doc => {
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

  async getStudentAppointments(studentId: string): Promise<Appointment[]> {
    const allSlotsSnapshot = await this.slotsCollection.get();
    const studentAppointments: Appointment[] = [];

    allSlotsSnapshot.docs.forEach(slotDoc => {
      const slotData = slotDoc.data() as TutoringSlot;
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