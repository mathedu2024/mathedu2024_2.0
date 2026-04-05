export interface TutoringSlot {
  id?: string;
  /** 老師的 Firestore 文件 ID（users 集合），如 2c8eac7b-d2bc-4f8b-a44d-b5c9b464d54b，作為溝通橋梁 */
  teacherId: string;
  /** 顯示用：老師姓名，由 users 的 name 欄位解析 */
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
