import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
 * Klinika rollari guruhlari — qayta-qayta yozilmasin uchun.
 */
export const ROLE_GROUPS = {
  ALL_MEDICAL: ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'] as const satisfies readonly Role[],
  DOCTORS: ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'] as const satisfies readonly Role[],
  NURSES: ['HEAD_NURSE', 'NURSE'] as const satisfies readonly Role[],
  LAB: ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH'] as const satisfies readonly Role[],
  PHARMACY: ['ADMIN', 'PHARMACIST'] as const satisfies readonly Role[],
  ADMIN_ONLY: ['ADMIN'] as const satisfies readonly Role[],
};
