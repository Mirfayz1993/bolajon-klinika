// Shared type definitions for the patient detail page.
// Sub-components keep their own narrow prop interfaces, but the page-level
// profile / domain shapes live here to avoid duplication.

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string | null;
  houseNumber: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  medicineName: string;
  dosage: string;
  duration: string;
  instructions?: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdAt: string;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
  prescriptions: Prescription[];
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  category: string;
  status: string;
  createdAt: string;
  appointment?: { type: string; dateTime: string } | null;
  admission?: { admissionType: string; admissionDate: string } | null;
}

export interface LabTest {
  id: string;
  status: string;
  results: Record<string, unknown> | null;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  testType: { name: string; unit?: string | null; normalRange?: string | null; price: number };
  labTech: { name: string; role: string };
  payment?: { id: string; status: string } | null;
}

export interface Admission {
  id: string;
  admissionType: string;
  admissionDate: string;
  status: string;
  dischargeDate?: string | null;
  dailyRate: number;
  notes?: string | null;
  bed: { bedNumber: string; room: { floor: number; roomNumber: string; type: string } };
}

export interface Appointment {
  id: string;
  type: string;
  status: string;
  dateTime: string;
  notes?: string | null;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
}

export interface NurseNote {
  id: string;
  procedure: string;
  notes?: string | null;
  medicines?: { name: string; quantity: number; unit: string }[] | null;
  noteType?: string | null;
  createdAt: string;
  nurse: { name: string; role: string };
  admission?: {
    bed: { bedNumber: string; room: { floor: number; roomNumber: string } };
  } | null;
}

export interface AssignedService {
  id: string;
  categoryName: string;
  itemName: string;
  price: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
  assignedAt: string;
  assignedBy: { name: string; role: string };
  doctor?: { name: string; role: string } | null;
  admission?: { bed: { bedNumber: string; room: { roomNumber: string; floor: number } } | null } | null;
}

export interface ProfileData {
  patient: Patient;
  medicalRecords: MedicalRecord[];
  payments: Payment[];
  labTests: LabTest[];
  admissions: Admission[];
  appointments: Appointment[];
  nurseNotes: NurseNote[];
}
