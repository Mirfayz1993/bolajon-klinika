import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get('showAll') === 'true';

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const queues = await prisma.queue.findMany({
      where: {
        ...(showAll ? {} : { status: { in: ['WAITING', 'CALLED'] } }),
        appointment: {
          dateTime: {
            gte: startOfDay,
            lte: endOfDay,
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
      orderBy: {
        queueNumber: 'asc',
      },
    });

    return NextResponse.json(queues);
  } catch (error) {
    console.error('Queue GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
