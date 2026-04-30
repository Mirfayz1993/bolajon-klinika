import { z } from 'zod';

// --- Vital (hayotiy ko'rsatkichlar) -------------------------------------------

export const vitalCreateSchema = z.object({
  temperature: z.number().min(25).max(45).optional(),
  bloodPressureSystolic: z.number().int().min(50).max(300).optional(),
  bloodPressureDiastolic: z.number().int().min(30).max(200).optional(),
  pulse: z.number().int().min(30).max(300).optional(),
  oxygenSaturation: z.number().min(50).max(100).optional(),
  weight: z.number().min(0.5).max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type VitalCreateInput = z.infer<typeof vitalCreateSchema>;

// --- Patient -----------------------------------------------------------------

export const patientCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  birthDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  phone: z.string().trim().min(7).max(30).optional(),
  parentPhone: z.string().trim().min(7).max(30).optional(),
  region: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  houseNumber: z.string().trim().max(50).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  medicalHistory: z.string().trim().max(5000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  chronicConditions: z.string().trim().max(2000).optional(),
});

export const patientUpdateSchema = patientCreateSchema.partial();

// --- Admission (statsionar) --------------------------------------------------

export const admissionCreateSchema = z.object({
  patientId: z.string().min(1),
  bedId: z.string().min(1),
  doctorId: z.string().min(1).optional(),
  diagnosis: z.string().trim().max(2000).optional(),
  dailyRate: z.number().nonnegative(),
});

export const admissionDischargeSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  dischargeNotes: z.string().trim().max(2000).optional(),
  manualAmount: z.number().nonnegative().optional(),
});

export const admissionUpdateSchema = z.object({
  diagnosis: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  dailyRate: z.number().nonnegative().optional(),
});

// --- Doctor note -------------------------------------------------------------

export const doctorNoteCreateSchema = z.object({
  diagnosis: z.string().trim().min(1).max(2000).optional(),
  treatment: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
  prescriptions: z
    .array(
      z.object({
        medicineName: z.string().trim().min(1).max(200),
        dosage: z.string().trim().min(1).max(200),
        duration: z.string().trim().min(1).max(200),
        instructions: z.string().trim().max(500).optional(),
      }),
    )
    .optional(),
});

// --- Task --------------------------------------------------------------------

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().min(1),
  patientId: z.string().min(1).optional(),
  deadline: z.string().datetime().optional(),
});

// --- Bot (Telegram callback) -------------------------------------------------

/** Bot callback'lardan keladigan chatId raqam yoki string bo'lishi mumkin */
const chatIdSchema = z.union([z.string().min(1), z.number().int()]);

export const botTaskStartSchema = z.object({
  chatId: chatIdSchema,
});

export const botTaskCompleteSchema = z.object({
  chatId: chatIdSchema,
  progressNote: z.string().trim().max(2000).optional(),
});

export const botAppointmentAcceptSchema = z.object({
  chatId: chatIdSchema,
});

export const botAppointmentRejectSchema = z.object({
  chatId: chatIdSchema,
  reason: z.string().trim().max(500).optional(),
});

export const botQueueActionSchema = z.object({
  chatId: chatIdSchema,
});

export const botQueueListQuerySchema = z.object({
  chatId: chatIdSchema,
});

// --- Prescription ------------------------------------------------------------

export const prescriptionCreateSchema = z.object({
  medicalRecordId: z.string().min(1),
  medicineName: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(200),
  frequency: z.string().trim().min(1).max(200),
  duration: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
});

// --- Medicine (dorixona) -----------------------------------------------------

export const medicineCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(100),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  supplierId: z.string().min(1).optional(),
  minStock: z.number().int().nonnegative().optional(),
  floor: z.number().int().min(2).max(3).optional(),
});

export const medicineUpdateSchema = medicineCreateSchema.partial();

export const medicineWriteOffSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

// --- Lab ---------------------------------------------------------------------

export const labTestTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().nonnegative(),
  description: z.string().trim().max(1000).optional(),
  normalRange: z.string().trim().max(200).optional(),
  normalMin: z.number().optional(),
  normalMax: z.number().optional(),
  unit: z.string().trim().max(50).optional(),
  category: z.string().trim().max(100).optional(),
  parentId: z.string().min(1).optional(),
});

export const labTestTypeUpdateSchema = labTestTypeCreateSchema.partial();

export const labTestCreateSchema = z.object({
  patientId: z.string().min(1),
  testTypeIds: z.array(z.string().min(1)).min(1),
  notes: z.string().trim().max(2000).optional(),
  paymentId: z.string().min(1).optional(),
});

export const labTestUpdateSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  results: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  notes: z.string().trim().max(2000).optional(),
  reagentId: z.string().min(1).optional(),
});

// --- Room / Bed / Inventory --------------------------------------------------

export const bedCreateSchema = z.object({
  bedNumber: z.string().trim().min(1).max(50),
});

export const inventoryAddSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive(),
  comment: z.string().trim().max(500).optional(),
});

export const inventoryWriteOffSchema = z.object({
  quantity: z.number().int().positive(),
  comment: z.string().trim().max(500).optional(),
});
