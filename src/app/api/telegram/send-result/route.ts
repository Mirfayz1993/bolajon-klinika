import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ROLE_GROUPS } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { z } from 'zod';

const sendResultSchema = z.object({
  labTestId: z.string().min(1),
  chatId: z.union([z.string(), z.number()]),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(ROLE_GROUPS.LAB);
  if (!auth.ok) return auth.response;

  try {
    const parsed = await validateBody(req, sendResultSchema);
    if (!parsed.ok) return parsed.response;
    const { labTestId, chatId } = parsed.data;

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
