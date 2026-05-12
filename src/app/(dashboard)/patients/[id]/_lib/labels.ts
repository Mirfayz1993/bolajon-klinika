// Centralized label / colour constants for the patient detail page.
// These were previously declared inline in page.tsx and LabTab.tsx.

export const CAT_LABELS: Record<string, string> = {
  CHECKUP: 'Shifokor ko\'rigi',
  LAB_TEST: 'Laboratoriya',
  SPEECH_THERAPY: 'Logoped',
  MASSAGE: 'Massaj',
  TREATMENT: 'Muolaja (ukol)',
  INPATIENT: 'Statsionar',
  AMBULATORY: 'Ambulator',
};

export const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-blue-100 text-blue-800',
};

export const LAB_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const APPT_TYPE_LABELS: Record<string, string> = {
  CHECKUP: 'Ko\'rik',
  FOLLOW_UP: 'Qayta ko\'rik',
  SPEECH_THERAPY: 'Logoped',
  MASSAGE: 'Massaj',
  LAB_TEST: 'Laboratoriya',
};

export const APPT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_QUEUE: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-slate-100 text-slate-700',
};
