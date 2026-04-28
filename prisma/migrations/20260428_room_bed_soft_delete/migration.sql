-- Room va Bed modellariga soft delete (deletedAt) qo'shish.
-- Maqsad: foydalanuvchi xona/kravatlarni xohlagancha o'chirish/qo'shish imkonini olishi
-- uchun. Tarixiy admission, payment, expense yozuvlari saqlanishi kerak (moliyaviy va
-- tibbiy audit uchun) — shuning uchun hard delete o'rniga soft delete: deletedAt
-- belgilanadi, ma'lumotlar saqlanadi, lekin UI'da ko'rinmaydi.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE beds ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "rooms_deletedAt_idx" ON rooms ("deletedAt");
CREATE INDEX IF NOT EXISTS "beds_deletedAt_idx" ON beds ("deletedAt");
