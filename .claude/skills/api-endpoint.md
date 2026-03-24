# API Endpoint yaratish (Next.js API Routes + Prisma)

## Qadamlar

1. `src/app/api/[modul]/route.ts` — GET, POST handler
2. `src/app/api/[modul]/[id]/route.ts` — GET (bitta), PUT, DELETE handler
3. `src/lib/prisma.ts` dan `prisma` import qilish
4. `src/lib/auth.ts` dan `authOptions` import qilish
5. Har routeda `getServerSession()` bilan auth tekshirish

## Route shablon

```typescript
// src/app/api/[modul]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.model.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const item = await prisma.model.create({ data });
  return NextResponse.json(item, { status: 201 });
}
```

```typescript
// src/app/api/[modul]/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const item = await prisma.model.update({ where: { id: params.id }, data });
  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.model.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Deleted' });
}
```

## Qoidalar

- Har routeda `getServerSession()` MAJBURIY
- Rol tekshiruvi kerak bo'lsa: `if (session.user.role !== 'ADMIN') return 403`
- Prisma faqat API Routes da — frontend da emas
- Error: try/catch + `NextResponse.json({ error: msg }, { status: 500 })`
- Response: list → array, bitta → object, create → 201, delete → `{ message }`
