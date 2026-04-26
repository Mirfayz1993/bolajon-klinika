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
  } catch {
    // Audit log yozish muvaffaqiyatsiz bo'lsa, asosiy jarayon to'xtatilmasin
  }
}
