import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function writeAuditLog({
  userId,
  action,
  module,
  details,
  ipAddress,
}: {
  userId: string;
  action: string;
  module: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: ipAddress ?? undefined,
      },
    });
  } catch (error) {
    // Audit yozish muvaffaqiyatsiz — asosiy jarayon to'xtatilmaydi,
    // lekin xato structured holatda stderr'ga chiqariladi (monitoring uchun).
    const payload = {
      level: 'error',
      event: 'AUDIT_LOG_FAILURE',
      userId,
      action,
      module,
      ipAddress,
      details,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      timestamp: new Date().toISOString(),
    };
    console.error('[AUDIT-FAIL]', JSON.stringify(payload));
  }
}
