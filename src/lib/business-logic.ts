/**
 * Klinika biznes mantiq funksiyalari.
 * Faqat sof hisob-kitob — DB ga bog'liq emas → test qilish oson.
 */

/**
 * Statsionar yotish kunlarini hisoblaydi.
 * 12-soat qoidasi: agar yotish ≤ 12 soat bo'lsa → 0 kun (bepul).
 * 12 soatdan ko'p → to'liq kun sifatida yuqoriga yaxlitlanadi.
 *
 * @example
 * calculateInpatientDays(t, t+6h)   → 0   (bepul)
 * calculateInpatientDays(t, t+12h)  → 0   (bepul, chegara qiymati)
 * calculateInpatientDays(t, t+13h)  → 1   (1 kun)
 * calculateInpatientDays(t, t+25h)  → 2   (2 kun)
 */
export function calculateInpatientDays(admission: Date, discharge: Date): number {
  const hours = (discharge.getTime() - admission.getTime()) / (1000 * 60 * 60);
  if (hours <= 12) return 0;
  return Math.ceil(hours / 24);
}

/**
 * Statsionar uchun to'lov summasini hisoblaydi.
 *
 * @param dailyRate - Kunlik narx (so'm)
 * @param days      - calculateInpatientDays() dan olingan kunlar
 */
export function calculateInpatientAmount(dailyRate: number, days: number): number {
  return dailyRate * days;
}

/**
 * Navbat raqamini validatsiya qiladi.
 * Navbat raqami musbat butun son bo'lishi kerak.
 */
export function isValidQueueNumber(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/**
 * O'zbek telefon raqamini tekshiradi.
 * Qabul qilinadigan formatlar:
 *   +998901234567
 *   998901234567
 *   0901234567
 */
export function isValidUzbekPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '');
  return /^(\+998|998|0)\d{9}$/.test(cleaned);
}

/**
 * JSHSHIR (14 raqamli ID) ni tekshiradi.
 */
export function isValidJshshir(jshshir: string): boolean {
  return /^\d{14}$/.test(jshshir);
}
