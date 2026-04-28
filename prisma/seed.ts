import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Sprint 13: RolePermission default seed olib tashlandi.
 *
 * Yangi tizim:
 * - ADMIN bypass: kod tomonida (`api-auth.ts` da `requireAction` ichida)
 * - Boshqa rollar: `UserPermission` orqali shaxsiy sozlanadi
 * - Yangi hodim qo'shilganda admin `/settings/permissions` sahifasida qo'lda
 *   sozlaydi yoki "Shablon olish" tugmasi orqali boshqa hodimdan ko'chiradi
 *
 * Bu fayl faqat ADMIN user yaratadi (loyihaning birinchi seed'i uchun).
 */

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin123', 10);

  await prisma.user.upsert({
    where: { phone: '+998901234567' },
    update: {},
    create: {
      name: 'Admin',
      phone: '+998901234567',
      email: 'admin@klinika.uz',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Seed completed: Admin user created');
  console.log('Phone: +998901234567');
  console.log('Password: Admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
