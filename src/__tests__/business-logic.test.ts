import { describe, it, expect } from 'vitest';
import {
  calculateInpatientDays,
  calculateInpatientAmount,
  isValidQueueNumber,
  isValidUzbekPhone,
  isValidJshshir,
} from '@/lib/business-logic';

// --- calculateInpatientDays ---------------------------------------------------

describe('calculateInpatientDays', () => {
  const base = new Date('2026-01-01T08:00:00.000Z');
  const hoursLater = (h: number) => new Date(base.getTime() + h * 60 * 60 * 1000);

  it('6 soat → 0 kun (bepul)', () => {
    expect(calculateInpatientDays(base, hoursLater(6))).toBe(0);
  });

  it('12 soat (chegara) → 0 kun (bepul)', () => {
    expect(calculateInpatientDays(base, hoursLater(12))).toBe(0);
  });

  it('12.1 soat → 1 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(12.1))).toBe(1);
  });

  it('13 soat → 1 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(13))).toBe(1);
  });

  it('24 soat → 1 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(24))).toBe(1);
  });

  it('25 soat → 2 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(25))).toBe(2);
  });

  it('48 soat → 2 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(48))).toBe(2);
  });

  it('49 soat → 3 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(49))).toBe(3);
  });

  it('7 kun → 7 kun', () => {
    expect(calculateInpatientDays(base, hoursLater(7 * 24))).toBe(7);
  });
});

// --- calculateInpatientAmount -------------------------------------------------

describe('calculateInpatientAmount', () => {
  it('0 kun → 0 so\'m', () => {
    expect(calculateInpatientAmount(150_000, 0)).toBe(0);
  });

  it('3 kun × 150_000 → 450_000', () => {
    expect(calculateInpatientAmount(150_000, 3)).toBe(450_000);
  });

  it('7 kun × 200_000 → 1_400_000', () => {
    expect(calculateInpatientAmount(200_000, 7)).toBe(1_400_000);
  });
});

// --- isValidQueueNumber -------------------------------------------------------

describe('isValidQueueNumber', () => {
  it('1 → to\'g\'ri', () => expect(isValidQueueNumber(1)).toBe(true));
  it('100 → to\'g\'ri', () => expect(isValidQueueNumber(100)).toBe(true));
  it('0 → noto\'g\'ri', () => expect(isValidQueueNumber(0)).toBe(false));
  it('-1 → noto\'g\'ri', () => expect(isValidQueueNumber(-1)).toBe(false));
  it('1.5 → noto\'g\'ri (kasr)', () => expect(isValidQueueNumber(1.5)).toBe(false));
});

// --- isValidUzbekPhone --------------------------------------------------------

describe('isValidUzbekPhone', () => {
  it('+998901234567 → to\'g\'ri', () => expect(isValidUzbekPhone('+998901234567')).toBe(true));
  it('998901234567 → to\'g\'ri', () => expect(isValidUzbekPhone('998901234567')).toBe(true));
  it('0901234567 → to\'g\'ri', () => expect(isValidUzbekPhone('0901234567')).toBe(true));
  it('+998 90 123 45 67 (bo\'sh joylar) → to\'g\'ri', () =>
    expect(isValidUzbekPhone('+998 90 123 45 67')).toBe(true));
  it('12345 → noto\'g\'ri (qisqa)', () => expect(isValidUzbekPhone('12345')).toBe(false));
  it('bo\'sh satr → noto\'g\'ri', () => expect(isValidUzbekPhone('')).toBe(false));
  it('+1234567890123 → noto\'g\'ri (boshqa mamlakat)', () =>
    expect(isValidUzbekPhone('+1234567890123')).toBe(false));
});

// --- isValidJshshir -----------------------------------------------------------

describe('isValidJshshir', () => {
  it('14 raqam → to\'g\'ri', () => expect(isValidJshshir('12345678901234')).toBe(true));
  it('13 raqam → noto\'g\'ri', () => expect(isValidJshshir('1234567890123')).toBe(false));
  it('15 raqam → noto\'g\'ri', () => expect(isValidJshshir('123456789012345')).toBe(false));
  it('harflar bor → noto\'g\'ri', () => expect(isValidJshshir('1234567890123A')).toBe(false));
  it('bo\'sh satr → noto\'g\'ri', () => expect(isValidJshshir('')).toBe(false));
});
