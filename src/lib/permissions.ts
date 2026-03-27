import { prisma } from './prisma';
import { Role } from '@prisma/client';

// Ruxsat darajalari (ierarxiya uchun)
export const ROLES_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  HEAD_DOCTOR: 80,
  DOCTOR: 60,
  HEAD_NURSE: 70,
  NURSE: 50,
  HEAD_LAB_TECH: 65,
  LAB_TECH: 45,
  RECEPTIONIST: 55,
  SPEECH_THERAPIST: 55,
  MASSAGE_THERAPIST: 55,
  SANITARY_WORKER: 20,
};

// ─── Dinamik permissions cache (60 soniya) ───────────────────────────────────

let cache: Map<string, boolean> | null = null;
let cacheTime = 0;

/**
 * Berilgan rol uchun sahifaga kirish huquqi bor-yo'qligini tekshiradi.
 * Natija 60 soniya davomida keshlanadi.
 * DB da yozuv bo'lmasa: ADMIN uchun true, qolganlar uchun false.
 */
export async function canRoleAccess(role: string, page: string): Promise<boolean> {
  const now = Date.now();

  if (!cache || now - cacheTime > 60_000) {
    const perms = await prisma.rolePermission.findMany();
    cache = new Map(perms.map((p: { role: string; page: string; canAccess: boolean }) => [`${p.role}:${p.page}`, p.canAccess]));
    cacheTime = now;
  }

  const key = `${role}:${page}`;
  if (cache.has(key)) return cache.get(key)!;

  // Default: DB da yozuv yo'q bo'lsa
  return role === 'ADMIN';
}

/**
 * Cache ni tozalaydi — PUT /api/permissions dan keyin chaqiriladi.
 */
export function invalidatePermissionsCache(): void {
  cache = null;
}

// ─── Statik yordamchi funksiyalar (mavjud kod bilan backward compatibility) ──

export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

export function canViewPatients(role: Role): boolean {
  return ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST', 'HEAD_NURSE', 'NURSE'].includes(role);
}
