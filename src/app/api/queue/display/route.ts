import { prisma } from '@/lib/prisma';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendData = async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const queues = await prisma.queue.findMany({
          where: {
            status: { in: ['WAITING', 'CALLED'] },
            appointment: {
              dateTime: { gte: startOfDay },
            },
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

        const data = JSON.stringify(queues);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      await sendData();

      const interval = setInterval(async () => {
        try {
          await sendData();
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 3000);

      return () => clearInterval(interval);
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
