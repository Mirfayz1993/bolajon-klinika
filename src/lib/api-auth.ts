import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canUserAccess, canRoleAccess } from '@/lib/permissions';
import { Role } from '@prisma/client';

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * Sessiya bor-yo'qligini tekshiradi va talab qilingan rollarga mos keladimi solishtiradi.
 *
 * Foydalanish:
 *   const auth = await requireRole(ROLE_GROUPS.DOCTORS);
 *   if (!auth.ok) return auth.response;
 *   const { session } = auth;
 *
 * @param allowed - Ruxsat etilgan rollar ro'yxati. Bo'sh bo'lsa, faqat sessiya tekshiriladi.
 */
export async function requireRole(allowed: readonly Role[] = []): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (allowed.length > 0 && !allowed.includes(session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, session };
}

/**
 * Faqat sessiya bor-yo'qligini tekshiradi (rolga e'tibor bermaydi).
 */
export async function requireSession(): Promise<AuthResult> {
  return requireRole([]);
}

/**
 * Action-level ruxsat tekshiruvi — masalan `/patients:create`, `/patients:edit`,
 * `/patients:tab:hamshira` kabi action key formatidagi yo'lni tekshiradi.
 *
 * Algoritm:
 *   1. Sessiya bor-yo'qligi
 *   2. ADMIN bo'lsa — har doim ruxsat
 *   3. UserPermission.canAccess=true bo'lsa — ruxsat (UserPermission ustunlik qiladi)
 *   4. UserPermission yo'q bo'lsa, RolePermission.canAccess=true bo'lsa — ruxsat
 *   5. Aks holda 403 Forbidden
 *
 * Foydalanish:
 *   const auth = await requireAction('/patients:create');
 *   if (!auth.ok) return auth.response;
 *   const { session } = auth;
 *
 * @param actionPath - DB'da saqlanadigan action key, masalan `/patients:create`
 */
export async function requireAction(actionPath: string): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // ADMIN har doim ruxsat oladi
  if (session.user.role === 'ADMIN') {
    return { ok: true, session };
  }

  const userId = session.user.id;
  const role = session.user.role as Role;

  // 1) UserPermission cache (ustunlik qiladi)
  const userResult = await canUserAccess(userId, actionPath);
  if (userResult === true) {
    return { ok: true, session };
  }
  if (userResult === false) {
    // UserPermission mavjud, lekin canAccess=false → ruxsat yo'q
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  // 2) UserPermission yozuvi yo'q → RolePermission cache
  const roleResult = await canRoleAccess(role, actionPath);
  if (roleResult) {
    return { ok: true, session };
  }

  return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

/**
 * Bir nechta action key'lardan **biri** uchun ruxsat bo'lsa o'tkazadi (OR-mantiq).
 *
 * Foydalanish:
 *   const auth = await requireAnyAction('/patients:edit', '/patients:create');
 *   if (!auth.ok) return auth.response;
 *
 * Algoritm `requireAction` bilan bir xil — har bir key uchun:
 *   1. ADMIN bo'lsa — har doim ruxsat
 *   2. UserPermission ustunlik (canAccess=true bo'lsa ruxsat, false bo'lsa o'sha key uchun rad)
 *   3. UserPermission yo'q bo'lsa, RolePermission.canAccess=true bo'lsa ruxsat
 *
 * Birorta key uchun ruxsat topilmasa 403 qaytaradi.
 */
export async function requireAnyAction(...actionPaths: string[]): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (actionPaths.length === 0) {
    return { ok: true, session };
  }

  // ADMIN har doim o'tadi
  if (session.user.role === 'ADMIN') {
    return { ok: true, session };
  }

  const userId = session.user.id;
  const role = session.user.role as Role;

  for (const actionPath of actionPaths) {
    // 1) UserPermission cache (ustunlik qiladi)
    const userResult = await canUserAccess(userId, actionPath);
    if (userResult === true) {
      return { ok: true, session };
    }
    if (userResult === false) {
      // canAccess=false → bu key bo'yicha rad, lekin boshqa key urinib ko'rilsin
      continue;
    }

    // 2) UserPermission yozuvi yo'q → RolePermission cache
    const roleResult = await canRoleAccess(role, actionPath);
    if (roleResult) {
      return { ok: true, session };
    }
  }

  return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

/**
 * Klinika rollari guruhlari — qayta-qayta yozilmasin uchun.
 */
export const ROLE_GROUPS = {
  ALL_MEDICAL: ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'] as const satisfies readonly Role[],
  DOCTORS: ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'] as const satisfies readonly Role[],
  NURSES: ['HEAD_NURSE', 'NURSE'] as const satisfies readonly Role[],
  LAB: ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH'] as const satisfies readonly Role[],
  PHARMACY: ['ADMIN', 'PHARMACIST'] as const satisfies readonly Role[],
  RECEPTION: ['ADMIN', 'RECEPTIONIST'] as const satisfies readonly Role[],
  ALL_STAFF: [
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
  ] as const satisfies readonly Role[],
  ADMIN_ONLY: ['ADMIN'] as const satisfies readonly Role[],
};
