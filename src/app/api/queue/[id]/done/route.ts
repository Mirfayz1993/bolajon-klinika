import { NextRequest, NextResponse } from 'next/server';
import { requireAction } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/queue:mark_done');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const existing = await prisma.queue.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
    }

    if (existing.status !== 'CALLED') {
      return NextResponse.json(
        { error: 'Queue entry must be in CALLED status to mark as done' },
        { status: 400 }
      );
    }

    const updated = await prisma.queue.update({
      where: { id },
      data: {
        status: 'DONE',
        appointment: {
          update: {
            status: 'COMPLETED',
          },
        },
      },
      include: {
        appointment: {
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            doctor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Queue done PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
