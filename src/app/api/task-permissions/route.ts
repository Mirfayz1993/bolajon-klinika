import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const perms = await prisma.taskAssignPermission.findMany({
      include: {
        assigner: { select: { id: true, name: true, role: true } },
        targetUser: { select: { id: true, name: true, role: true } },
        grantedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(perms);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as { assignerId: string; targetUserId: string };
    const { assignerId, targetUserId } = body;
    if (!assignerId || !targetUserId) return NextResponse.json({ error: 'Majburiy maydonlar' }, { status: 400 });

    const perm = await prisma.taskAssignPermission.upsert({
      where: { assignerId_targetUserId: { assignerId, targetUserId } },
      create: { grantedById: session.user.id, assignerId, targetUserId },
      update: { grantedById: session.user.id },
      include: {
        assigner: { select: { id: true, name: true, role: true } },
        targetUser: { select: { id: true, name: true, role: true } },
      },
    });
    return NextResponse.json(perm, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
