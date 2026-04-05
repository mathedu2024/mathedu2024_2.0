// services/client/tutoringService.ts
import { TutoringSlot, Appointment } from '@/services/interfaces';

export const listAllTutoringSlots = async (): Promise<TutoringSlot[]> => {
  const res = await fetch('/api/tutoring/list-all-slots');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch tutoring slots' }));
    throw new Error(errorData.error);
  }
  const data = await res.json();
  return data.slots || [];
};

export const listStudentAppointments = async (studentId: string): Promise<Appointment[]> => {
    const res = await fetch('/api/tutoring/list-student-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch appointments' }));
        throw new Error(errorData.error);
    }
    const data = await res.json();
    return data.appointments || [];
};

export const updateStudentAppointment = async (payload: {slotId: string, studentId: string, status?: string, problemDescription?: string }): Promise<any> => {
    const res = await fetch('/api/tutoring/update-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update appointment' }));
        throw new Error(errorData.error);
    }
    return await res.json();
};

export const bookAppointment = async (appointmentData: any): Promise<any> => {
    const res = await fetch('/api/tutoring/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to book appointment' }));
        throw new Error(errorData.error);
    }
    return await res.json();
};
