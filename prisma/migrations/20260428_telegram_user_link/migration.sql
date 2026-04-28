-- Telegram xodim bog'lanish uchun User modelga ustunlar
ALTER TABLE users ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "telegramVerificationCode" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "telegramVerificationExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegramChatId_key" ON users ("telegramChatId");

-- Task modelga Telegram xabarni kuzatish uchun ustunlar (Faza 2-3'da ishlatiladi).
-- Ba'zi muhitlarda `tasks` jadvali hali yaratilmagan bo'lishi mumkin (schema o'zgarishlari ketma-ket
-- migration'larsiz `db push` orqali kelgan bo'lishi mumkin) — shuning uchun jadval bo'lmasa
-- bu blok jimgina o'tkazib yuboriladi. Jadval keyinchalik yaratilganida ustunlar schema bo'yicha
-- avtomatik shakllanadi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "telegramMessageId" INTEGER';
    EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3)';
  END IF;
END $$;
