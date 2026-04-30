-- Appointment modeliga Telegram xabarni kuzatish uchun ustunlar.
-- Doktorga uchrashuv haqida bildirishnoma yuborilganda Telegram message_id va vaqti saqlanadi.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "telegramMessageId" INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
