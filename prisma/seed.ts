import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// prisma generate ishlagandan keyin bu cast kerak bo'lmaydi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient() as any;

const ALL_ROLES: Role[] = [
  'ADMIN',
  'HEAD_DOCTOR',
  'DOCTOR',
  'HEAD_NURSE',
  'NURSE',
  'HEAD_LAB_TECH',
  'LAB_TECH',
  'RECEPTIONIST',
  'SPEECH_THERAPIST',
  'MASSAGE_THERAPIST',
  'SANITARY_WORKER',
];

// Har bir sahifa uchun canAccess: true bo'lgan rollar
const PAGE_ACCESS: Record<string, Role[]> = {
  '/dashboard':           ALL_ROLES,
  '/patients':            ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'],
  '/appointments':        ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'],
  '/payments':            ['ADMIN', 'HEAD_DOCTOR', 'RECEPTIONIST'],
  '/lab':                 ['ADMIN', 'HEAD_DOCTOR', 'HEAD_LAB_TECH', 'LAB_TECH', 'DOCTOR'],
  '/staff':               ['ADMIN', 'HEAD_DOCTOR'],
  '/queue':               ALL_ROLES,
  '/rooms':               ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'],
  '/admissions':          ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/ambulatory':          ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'],
  '/schedule':            ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'],
  '/reports':             ['ADMIN', 'HEAD_DOCTOR'],
  '/settings':            ['ADMIN'],
  '/settings/permissions':['ADMIN'],
  '/audit-logs':          ['ADMIN'],
  '/medical-records':     ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'],
  '/services':            ALL_ROLES,
};

const ALL_PAGES = Object.keys(PAGE_ACCESS);

async function main() {
  // Admin user
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

  // RolePermission seed — barcha rol + sahifa kombinatsiyalari
  let upsertCount = 0;

  for (const page of ALL_PAGES) {
    const allowedRoles = PAGE_ACCESS[page];

    for (const role of ALL_ROLES) {
      const canAccess = allowedRoles.includes(role);

      await prisma.rolePermission.upsert({
        where: { role_page: { role, page } },
        update: { canAccess },
        create: { role, page, canAccess },
      });

      upsertCount++;
    }
  }

  console.log(`RolePermission seed completed: ${upsertCount} yozuv upsert qilindi`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
