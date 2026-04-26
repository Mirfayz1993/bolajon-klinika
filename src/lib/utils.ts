/**
 * Qavat raqamini inson uchun tushunarli nomga o'giradi:
 * 1 → Podval
 * 2 → 1-qavat
 * 3 → 2-qavat
 * 4 → 3-qavat
 */
export function floorLabel(floor: number): string {
  if (floor === 1) return 'Podval';
  return `${floor - 1}-qavat`;
}
