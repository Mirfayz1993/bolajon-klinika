import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const signal = req.signal; // Client ulanishi uzilsa — abort bo'ladi

  const stream = new ReadableStream({
    async start(controller) {
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        try { controller.close(); } catch { /* allaqachon yopilgan */ }
      };

      const sendData = async () => {
        if (signal.aborted) { cleanup(); return; }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const queues = await prisma.queue.findMany({
          where: {
            status: { in: ['WAITING', 'CALLED'] },
            appointment: { dateTime: { gte: startOfDay } },
          },
          include: {
            appointment: {
              include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { select: { name: true } },
              },
            },
          },
          orderBy: { queueNumber: 'asc' },
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(queues)}\n\n`));
      };

      // Abort event'ini tinglash
      signal.addEventListener('abort', cleanup, { once: true });

      try {
        await sendData();
      } catch {
        cleanup();
        return;
      }

      intervalId = setInterval(async () => {
        try {
          await sendData();
        } catch {
          cleanup();
        }
      }, 3000);

      // ReadableStream cancel callback
      return () => {
        signal.removeEventListener('abort', cleanup);
        cleanup();
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
