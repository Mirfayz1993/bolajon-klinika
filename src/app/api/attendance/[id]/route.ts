import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ROLE_GROUPS } from '@/lib/api-auth';

const ATTENDANCE_ROLES = [
  'ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE', 'DOCTOR', 'NURSE',
  'HEAD_LAB_TECH', 'LAB_TECH', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST', 'SANITARY_WORKER',
] as const;

// PATCH /api/attendance/[id]  → check-out
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(ATTENDANCE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const record = await prisma.attendance.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
  if (record.checkOut) return NextResponse.json({ error: 'Allaqachon chiqib ketgan' }, { status: 400 });

  const updated = await prisma.attendance.update({
    where: { id },
    data: { checkOut: new Date() },
    include: {
      user: { select: { id: true, name: true, role: true } },
      room: { select: { id: true, floor: true, roomNumber: true, type: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/attendance/[id]  → yozuvni o'chirish (faqat ADMIN)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await prisma.attendance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
