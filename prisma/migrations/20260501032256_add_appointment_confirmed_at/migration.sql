-- Appointment'ga doktor tasdiqlash izi qo'shish.
-- Doktor Telegram'da "✅ Tasdiqlash" tugmasini bosganda confirmedAt yoziladi.
-- status enum o'zgartirilmaydi — uchrashuv SCHEDULED holatida qoladi.
ALTER TABLE "appointments" ADD COLUMN "confirmedAt" TIMESTAMP(3);
