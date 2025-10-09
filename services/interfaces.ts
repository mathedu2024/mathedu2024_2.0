export interface TutoringSlot {
  id?: string;
  teacherId: string;
  teacherName?: string;
  date: string; 
  startTime: string;
  endTime: string;
  participantLimit: number;
  available: boolean;
  bookedStudents?: BookedStudent[];
  bookedCount?: number;
  isBookedByCurrentUser?: boolean;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  method?: string;
  locationType?: string;
  locationDetails?: string;
  qualifications?: any;
  remarks?: string;
  mode?: string;
  isFull?: boolean;
}

export interface Appointment {
  id?: string;
  slotId: string;
  studentId: string;
  studentDisplayId: string;
  studentName: string;
  studentEmail: string;
  problemDescription?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  bookingTimestamp?: string;
  slotDetails?: TutoringSlot;
}

export interface BookedStudent extends Appointment {
  studentGrade?: string;
  studentAccount?: string;
  appointmentId?: string;
}
