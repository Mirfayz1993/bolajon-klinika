import { describe, it, expect } from 'vitest';
import { ROLES_HIERARCHY } from '@/lib/permissions';

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
