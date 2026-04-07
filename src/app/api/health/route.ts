import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latency_ms: dbLatency,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
