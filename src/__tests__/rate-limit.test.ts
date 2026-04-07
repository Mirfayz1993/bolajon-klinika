import { describe, it, expect, beforeEach, vi } from 'vitest';

// Store'ni har test uchun tozalash uchun modul qayta yuklanadi
// Vitest modul caching ni izolyatsiyalaydi

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('birinchi so\'rov — ruxsat etiladi', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = rateLimit('test-user-1', 3, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('limitgacha so\'rovlar — barchasi o\'tadi', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const id = 'test-user-2';
    rateLimit(id, 3, 60_000);
    rateLimit(id, 3, 60_000);
    const last = rateLimit(id, 3, 60_000);
    expect(last.success).toBe(true);
    expect(last.remaining).toBe(0);
  });

  it('limitdan keyin — bloklanadi', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const id = 'test-user-3';
    rateLimit(id, 2, 60_000);
    rateLimit(id, 2, 60_000);
    const blocked = rateLimit(id, 2, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetTime).toBeDefined();
  });

  it('vaqt o\'tgandan keyin — qayta ruxsat etiladi', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const id = 'test-user-4';

    // Limit to'ld
    rateLimit(id, 1, 100); // 100ms window
    const blocked = rateLimit(id, 1, 100);
    expect(blocked.success).toBe(false);

    // 150ms kutib — vaqt o'tadi
    await new Promise((r) => setTimeout(r, 150));

    const allowed = rateLimit(id, 1, 100);
    expect(allowed.success).toBe(true);
  });

  it('turli identifierlar bir-biriga ta\'sir qilmaydi', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    rateLimit('user-A', 1, 60_000);
    rateLimit('user-A', 1, 60_000); // bloklangan

    const userB = rateLimit('user-B', 1, 60_000);
    expect(userB.success).toBe(true); // user-B ta'sirlanmaydi
  });
});
