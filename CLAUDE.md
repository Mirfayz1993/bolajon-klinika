# Bolajon Klinika CMS — Claude Uchun Loyiha Qo'llanmasi

## Loyiha haqida

**Bolajon Klinika CMS** — bolalar klinikalari uchun to'liq boshqaruv tizimi.
4 qavatli klinika: laboratoriya, qabulxona, ambulator muolaja, statsionar.

## Tech Stack

| Texnologiya | Versiya | Maqsad |
|-------------|---------|--------|
| Next.js | 14+ | Full-stack framework (App Router) |
| TypeScript | 5+ | Strict typing |
| Prisma ORM | 5+ | PostgreSQL bilan ishlash |
| PostgreSQL | 16+ | Ma'lumotlar bazasi |
| NextAuth.js | 4+ | Autentifikatsiya + sessiya (RBAC) |
| Tailwind CSS | 3+ | Styling |
| Lucide React | latest | Ikonkalar |
| node-telegram-bot-api | latest | Telegram bot (alohida servis) |

## Loyiha tuzilishi

```
clinic-cms/
├── prisma/
│   ├── schema.prisma          ← 20 jadval, O'ZGARTIRMA
│   └── seed.ts
├── public/
│   └── locales/
│       ├── uz-latin.json      ← i18n kalitlari (Lotin)
│       └── uz-cyrillic.json   ← i18n kalitlari (Kirill)
├── src/
│   ├── app/
│   │   ├── (auth)/login/      ← Login sahifasi
│   │   ├── (dashboard)/       ← Barcha asosiy sahifalar
│   │   │   ├── layout.tsx     ← Sidebar + Header, O'ZGARTIRMA (tayyor bo'lsa)
│   │   │   ├── patients/
│   │   │   ├── appointments/
│   │   │   ├── payments/
│   │   │   ├── lab/
│   │   │   ├── pharmacy/
│   │   │   ├── rooms/
│   │   │   ├── admissions/
│   │   │   ├── staff/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── queue-display/     ← TV navbat ekrani (SSE)
│   │   └── api/               ← Barcha API endpointlar
│   ├── components/
│   │   ├── ui/                ← Umumiy komponentlar
│   │   └── layout/            ← Sidebar, Header
│   ├── lib/
│   │   ├── prisma.ts          ← Prisma client, O'ZGARTIRMA
│   │   ├── auth.ts            ← NextAuth config, O'ZGARTIRMA
│   │   └── permissions.ts     ← RBAC yordamchi funksiyalar
│   ├── hooks/
│   │   └── useLanguage.ts     ← i18n hook
│   └── types/
│       └── index.ts           ← Umumiy TypeScript typelari
└── telegram-bot/              ← Alohida Telegram bot servisi
```

## Asosiy qoidalar

### Backend (API Routes)

```typescript
// HAR DOIM shu pattern:
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ...
}
```

- Prisma FAQAT API Routes da — frontend da HECH QACHON
- Har API da `getServerSession()` — istisnossiz
- Error: `try/catch` + `NextResponse.json({ error }, { status })`

### Frontend (Next.js Pages)

```typescript
"use client"; // sahifa boshida MAJBURIY

// Ma'lumot olish:
const res = await fetch('/api/patients');
const data = await res.json();

// QILMA: import { prisma } from '@/lib/prisma' — frontend da ASLO
```

- Barcha matnlar `useLanguage()` hook orqali — hardcoded YOZMA
- Styling faqat Tailwind CSS — inline style QILMA
- Ikonkalar faqat Lucide React

### i18n

```typescript
const { t, locale } = useLanguage();
// t.patients.title → "Bemorlar" (lotin) | "Беморлар" (kirill)
// t.common.save    → "Saqlash"          | "Сақлаш"
```

Yangi kalit kerak bo'lsa — `public/locales/uz-latin.json` va `uz-cyrillic.json` ga qo'sh.

## Rollar (RBAC)

| Rol | Prisma enum |
|-----|-------------|
| Klinika rahbari | `ADMIN` |
| Bosh shifokor | `HEAD_DOCTOR` |
| Shifokor | `DOCTOR` |
| Bosh hamshira | `HEAD_NURSE` |
| Hamshira | `NURSE` |
| Bosh laborant | `HEAD_LAB_TECH` |
| Laborant | `LAB_TECH` |
| Qabulxona hodimi | `RECEPTIONIST` |
| Logoped | `SPEECH_THERAPIST` |
| Massajchi | `MASSAGE_THERAPIST` |
| Sanitar hodim | `SANITARY_WORKER` |

## Klinika-spetsifik business logic

### Statsionar to'lov (12-soat qoidasi)
```typescript
// 12 soatgacha = BEPUL, 12 soatdan ko'p = to'liq kun hisoblanadi
function calculateInpatientDays(admission: Date, discharge: Date): number {
  const hours = (discharge.getTime() - admission.getTime()) / (1000 * 60 * 60);
  if (hours <= 12) return 0;
  return Math.ceil(hours / 24);
}
```

### Dori chiqimida 3 ta amal BIRGALIKDA bajariladi
1. `MedicineTransaction.create` (STOCK_OUT)
2. `Medicine.update` — `quantity` kamayadi
3. `Payment.create` — dori narxi statsionar to'lovga qo'shiladi

### Lab natija holati ketma-ketligi
```
PENDING → IN_PROGRESS → COMPLETED
```
Orqaga qaytib bo'lmaydi.

## Real-time (TV navbat ekrani)

Socket.io EMAS — **SSE (Server-Sent Events)** ishlatiladi:
```typescript
// src/app/api/queue/display/route.ts
export async function GET() {
  const stream = new ReadableStream({ /* ... */ });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  });
}
```

## Tailwind rang standartlari

| Holat | Rang |
|-------|------|
| SCHEDULED / AVAILABLE / PAID / COMPLETED | `bg-green-100 text-green-800` |
| IN_PROGRESS / PARTIAL | `bg-yellow-100 text-yellow-800` |
| CANCELLED / OCCUPIED | `bg-red-100 text-red-800` |
| PENDING | `bg-slate-100 text-slate-800` |
| IN_QUEUE | `bg-blue-100 text-blue-800` |

## Agent jamoa

Loyiha `.claude/skills/.agents/` papkasida 6 ta agent profili mavjud:

| Agent | Model | Rol |
|-------|-------|-----|
| PM Sardor | Opus | Boshqaruvchi |
| Backend Botir | Sonnet | API Routes + Prisma |
| Frontend Farid | Sonnet | Next.js + Tailwind |
| Reviewer Ravshan | Haiku | Spec compliance |
| QA Qadir | Sonnet | TypeScript + lint |
| Bughunter Bahodir | Sonnet | Moliyaviy logic buglar |

Ish tartibi: **Backend → Review → Frontend → Review → QA → Bughunter (moliyaviy tasklarda)**

## Muhim fayllar

| Fayl | Izoh |
|------|------|
| `prisma/schema.prisma` | 20 jadval — O'ZGARTIRMA |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/auth.ts` | NextAuth + RBAC config |
| `src/hooks/useLanguage.ts` | i18n hook |
| `public/locales/uz-latin.json` | O'zbek lotin tarjimalari |
| `public/locales/uz-cyrillic.json` | O'zbek kirill tarjimalari |
| `docs/plans/implementation-plan.md` | 18 ta task, 5 faza |
