import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.HEAD_LAB_TECH, Role.LAB_TECH];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as { labTestId?: string; chatId?: number };
    const { labTestId, chatId } = body;

    if (!labTestId || !chatId) {
      return NextResponse.json({ error: 'labTestId va chatId majburiy' }, { status: 400 });
    }

    const labTest = await prisma.labTest.findUnique({
      where: { id: labTestId },
      include: {
        testType: { select: { name: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    if (!labTest) {
      return NextResponse.json({ error: 'Lab test topilmadi' }, { status: 404 });
    }

    if (labTest.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Tahlil natijasi hali tayyor emas' }, { status: 400 });
    }

    // Telegram API orqali xabar yuborish
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Telegram token sozlanmagan' }, { status: 500 });
    }

    const message = `🔬 Tahlil natijasi tayyor!\n\nBemor: ${labTest.patient.firstName} ${labTest.patient.lastName}\nTahlil: ${labTest.testType.name}\nHolat: Tayyor ✅`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    const tgData = await tgRes.json() as { ok: boolean; description?: string };
    if (!tgData.ok) {
      return NextResponse.json({ error: `Telegram xatosi: ${tgData.description}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[telegram/send-result]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
