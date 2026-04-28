import { PrismaClient, Role } from '@prisma/client';

/**
 * Action-level RolePermission default mapping.
 *
 * Bu yerda har bir action key (`/page:action`) uchun qaysi rollar default'da
 * ruxsatga ega bo'lishi belgilanadi. Bu mapping eski hardcode role check'larni
 * regressiyasiz ko'chirish uchun yagona manba bo'lib xizmat qiladi.
 *
 * Idempotent — `seedActionPermissions` qayta-qayta ishga tushirilsa
 * bir xil natija beradi, mavjud yozuvlarni `update`'ga {canAccess} qaytaradi.
 */
export const ACTION_ACCESS: Record<string, Role[]> = {
  // /patients
  '/patients:create': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR'],
  '/patients:edit':   ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR'],
  '/patients:delete': ['ADMIN'],
  '/patients:see_prices': ['ADMIN', 'RECEPTIONIST'],
  '/patients:manage_services': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'],
  '/patients:order_lab': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST'],
  '/patients:add_vital': ['ADMIN', 'HEAD_NURSE', 'NURSE', 'HEAD_DOCTOR', 'DOCTOR'],
  '/patients:create_note': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'],
  '/patients:tab:xizmatlar': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/patients:tab:tashxislar': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'],
  '/patients:tab:hamshira': ['ADMIN', 'HEAD_NURSE', 'NURSE', 'HEAD_DOCTOR', 'DOCTOR'],
  '/patients:tab:laboratoriya': ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH', 'HEAD_DOCTOR', 'DOCTOR'],
  '/patients:tab:statsionar': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'],

  // /payments
  '/payments:create': ['ADMIN', 'RECEPTIONIST'],
  '/payments:edit': ['ADMIN', 'HEAD_DOCTOR', 'RECEPTIONIST'],
  '/payments:refund': ['ADMIN'],
  '/payments:delete': ['ADMIN'],
  '/payments:see_all': ['ADMIN', 'HEAD_DOCTOR', 'RECEPTIONIST'],

  // /lab
  '/lab:create': ['ADMIN', 'HEAD_LAB_TECH', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST'],
  '/lab:result': ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH'],
  '/lab:edit_test': ['ADMIN', 'HEAD_LAB_TECH'],
  '/lab:delete': ['ADMIN', 'HEAD_LAB_TECH'],

  // /staff
  '/staff:create': ['ADMIN'],
  '/staff:edit': ['ADMIN'],
  '/staff:delete': ['ADMIN'],
  '/staff:change_password': ['ADMIN'],
  '/staff:manage_permissions': ['ADMIN'],

  // /queue
  '/queue:create': ['ADMIN', 'RECEPTIONIST'],
  '/queue:call': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/queue:mark_done': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/queue:set_urgent': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR'],

  // /doctor-queue
  '/doctor-queue:order': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'],
  '/doctor-queue:manage': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'],

  // /admissions
  '/admissions:create': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'],
  '/admissions:discharge': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE'],
  '/admissions:edit_rate': ['ADMIN'],
  '/admissions:delete': ['ADMIN'],

  // /ambulatory
  '/ambulatory:create': ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/ambulatory:discharge': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST'],

  // /appointments
  '/appointments:create': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST'],
  '/appointments:edit': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST'],
  '/appointments:delete': ['ADMIN'],

  // /pharmacy
  '/pharmacy:create': ['ADMIN', 'HEAD_NURSE', 'NURSE'],
  '/pharmacy:dispense': ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'NURSE'],
  '/pharmacy:writeoff': ['ADMIN', 'HEAD_NURSE'],
  '/pharmacy:edit': ['ADMIN', 'HEAD_NURSE'],
  '/pharmacy:manage_suppliers': ['ADMIN', 'HEAD_NURSE'],

  // /rooms
  '/rooms:create': ['ADMIN'],
  '/rooms:edit': ['ADMIN'],
  '/rooms:delete': ['ADMIN'],
  '/rooms:manage_inventory': ['ADMIN', 'HEAD_NURSE'],
  '/rooms:assign_responsible': ['ADMIN'],

  // /tasks
  '/tasks:create': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'HEAD_LAB_TECH'],
  '/tasks:assign': ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'HEAD_LAB_TECH'],
  '/tasks:complete_others': ['ADMIN'],
  '/tasks:delete': ['ADMIN'],

  // /expenses
  '/expenses:create': ['ADMIN'],
  '/expenses:edit': ['ADMIN'],
  '/expenses:delete': ['ADMIN'],

  // /schedule
  '/schedule:create': ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'],
  '/schedule:edit_others': ['ADMIN'],
  '/schedule:delete': ['ADMIN'],

  // /medical-records
  '/medical-records:create': ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'],
  '/medical-records:edit': ['ADMIN', 'HEAD_DOCTOR'],
  '/medical-records:delete': ['ADMIN'],

  // /settings
  '/settings:manage_specs': ['ADMIN'],
  '/settings:manage_room_types': ['ADMIN'],
  '/settings:manage_service_categories': ['ADMIN'],
  '/settings:manage_service_items': ['ADMIN'],

  // /reports
  '/reports:export': ['ADMIN', 'HEAD_DOCTOR'],
  '/reports:see_financial': ['ADMIN', 'HEAD_DOCTOR', 'HEAD_LAB_TECH'],
};

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
  'PHARMACIST',
];

/**
 * Action-level RolePermission yozuvlarini upsert qiladi.
 *
 * - Idempotent: re-run safe — har safar bir xil natija beradi.
 * - Mavjud yozuvlarni default qiymatlarga qaytaradi (`update: { canAccess }`).
 *   Bu seed maqsadida — production'da admin qiymatlari saqlanishi uchun
 *   `scripts/migrate-action-permissions.ts` ishlatiladi.
 */
export async function seedActionPermissions(prisma: PrismaClient) {
  for (const [page, allowedRoles] of Object.entries(ACTION_ACCESS)) {
    for (const role of ALL_ROLES) {
      const canAccess = allowedRoles.includes(role);
      await prisma.rolePermission.upsert({
        where: { role_page: { role, page } },
        create: { role, page, canAccess },
        update: { canAccess },
      });
    }
  }
  console.log(`✓ Seeded ${Object.keys(ACTION_ACCESS).length} action permissions`);
}
