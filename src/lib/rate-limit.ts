/**
 * In-memory rate limiter.
 * Login endpointi uchun: 5 ta urinish / 15 daqiqa.
 * Server restart bo'lsa — reset bo'ladi (klinika miqyosi uchun yetarli).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitRecord>();

// Eskirgan yozuvlarni har 5 daqiqada tozala
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime?: number;
}

/**
 * @param identifier - IP manzil yoki telefon raqam
 * @param limit      - Ruxsat etilgan so'rovlar soni (default: 5)
 * @param windowMs   - Vaqt oynasi ms da (default: 15 daqiqa)
 */
export function rateLimit(
  identifier: string,
  limit = 5,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || now > record.resetTime) {
    store.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}
