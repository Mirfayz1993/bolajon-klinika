import { describe, it, expect } from 'vitest';
import { ROLES_HIERARCHY, isAdmin, canViewPatients } from '@/lib/permissions';

describe('ROLES_HIERARCHY', () => {
  it('ADMIN eng yuqori daraja (100)', () => {
    expect(ROLES_HIERARCHY.ADMIN).toBe(100);
  });

  it('HEAD_DOCTOR DOCTOR dan yuqori', () => {
    expect(ROLES_HIERARCHY.HEAD_DOCTOR).toBeGreaterThan(ROLES_HIERARCHY.DOCTOR);
  });

  it('SANITARY_WORKER eng past daraja', () => {
    const levels = Object.values(ROLES_HIERARCHY);
    expect(ROLES_HIERARCHY.SANITARY_WORKER).toBe(Math.min(...levels));
  });

  it('barcha 12 ta rol mavjud', () => {
    expect(Object.keys(ROLES_HIERARCHY)).toHaveLength(12);
  });
});

describe('isAdmin', () => {
  it('ADMIN → true', () => expect(isAdmin('ADMIN' as never)).toBe(true));
  it('HEAD_DOCTOR → false', () => expect(isAdmin('HEAD_DOCTOR' as never)).toBe(false));
  it('DOCTOR → false', () => expect(isAdmin('DOCTOR' as never)).toBe(false));
});

describe('canViewPatients', () => {
  it('ADMIN → true', () => expect(canViewPatients('ADMIN' as never)).toBe(true));
  it('DOCTOR → true', () => expect(canViewPatients('DOCTOR' as never)).toBe(true));
  it('RECEPTIONIST → true', () => expect(canViewPatients('RECEPTIONIST' as never)).toBe(true));
  it('SANITARY_WORKER → false', () => expect(canViewPatients('SANITARY_WORKER' as never)).toBe(false));
  it('MASSAGE_THERAPIST → false', () => expect(canViewPatients('MASSAGE_THERAPIST' as never)).toBe(false));
});
