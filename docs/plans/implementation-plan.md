# Bolajon Klinika CMS — Implementation Plan

**Versiya:** 1.0
**Sana:** 2026-03-24
**Umumiy tasks:** 18
**Fazalar:** 5

---

## Faza 1: Asos (Foundation)

### Task 1: Loyiha sozlash va infratuzilma

**Maqsad:** Next.js loyihasini yaratish, database, auth va i18n ni sozlash

**Steps:**
1. `npx create-next-app@latest clinic-cms --typescript --tailwind --app` bilan loyiha yaratish
2. Zarur paketlarni o'rnatish:
   ```bash
   npm install prisma @prisma/client next-auth @auth/prisma-adapter
   npm install lucide-react
   npm install -D @types/node
   ```
3. `prisma/schema.prisma` — PRD dagi 20 ta jadval schemani yozish
4. `.env` faylni yaratish (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`)
5. `src/lib/prisma.ts` — Prisma client singleton
6. `npx prisma migrate dev --name init` — migration yaratish

**Fayllar:**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/prisma.ts`
- `.env`, `.env.example`
- `package.json`

**Constraints:**
- `prisma/schema.prisma` — PRD dagi schema bilan bir xil bo'lsin, o'zgartirma
- Seed: 1 ta ADMIN user yaratilsin (login: `admin@klinika.uz`, password: `Admin123`)

---

### Task 2: NextAuth + RBAC autentifikatsiya

**Maqsad:** Login tizimi va rolga asoslangan kirish nazorati

**Steps:**
1. `src/lib/auth.ts` — NextAuth konfiguratsiya (CredentialsProvider)
2. `src/lib/permissions.ts` — RBAC helper funksiyalar
3. `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
4. `src/app/(auth)/login/page.tsx` — Login sahifasi (Tailwind)
5. `src/middleware.ts` — Route protection middleware

**Fayllar:**
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/(auth)/login/page.tsx`
- `src/middleware.ts`

**Auth logikasi:**
```typescript
// Login: phone yoki email + password
// Session: { user: { id, name, role, phone } }
// RBAC: getServerSession() -> session.user.role
```

**Constraints:**
- Password: bcrypt bilan hash qilinadi
- Session strategy: `jwt`
- Protected routes: `/dashboard/*` — login talab qiladi
- `/login` — autentifikatsiya qilingan foydalanuvchini `/dashboard` ga redirect qiladi

---

### Task 3: i18n (Lotin/Kirill) + Layout + Navigatsiya

**Maqsad:** Til almashtirish tizimi va asosiy dashboard layout

**Steps:**
1. `public/locales/uz-latin.json` — O'zbek lotin tarjimalari (barcha modullar uchun)
2. `public/locales/uz-cyrillic.json` — O'zbek kirill tarjimalari
3. `src/hooks/useLanguage.ts` — i18n hook
4. `src/app/(dashboard)/layout.tsx` — Sidebar + Header layout
5. `src/components/layout/Sidebar.tsx` — Navigatsiya (rol bo'yicha menyu)
6. `src/components/layout/Header.tsx` — Til tugmasi, foydalanuvchi info, logout
7. `src/app/(dashboard)/dashboard/page.tsx` — Asosiy dashboard (statistika kartalar)

**i18n kalitlari (minimal):**
```json
{
  "nav": { "dashboard": "Bosh sahifa", "patients": "Bemorlar", ... },
  "common": { "add": "Qo'shish", "save": "Saqlash", "cancel": "Bekor qilish",
               "delete": "O'chirish", "edit": "Tahrirlash", "search": "Qidirish",
               "loading": "Yuklanmoqda...", "actions": "Amallar",
               "confirmDelete": "O'chirishni tasdiqlaysizmi?" },
  "patients": { "title": "Bemorlar", ... },
  ...
}
```

**Fayllar:**
- `public/locales/uz-latin.json`
- `public/locales/uz-cyrillic.json`
- `src/hooks/useLanguage.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

**Constraints:**
- Sidebar: rol bo'yicha menyu itemlari ko'rsatilsin (ADMIN hammani ko'radi)
- Til tanlov `localStorage` da saqlansin
- `"use client"` — barcha sahifa va komponentlarda

---

### Task 4: Admin panel — Xodimlar va Mutaxassisliklar boshqaruvi

**Maqsad:** Admin xodim qo'shishi, o'zgartirishi, o'chirishi; mutaxassisliklar boshqaruvi

**Backend (Botir):**
- `GET/POST /api/users` — xodimlar ro'yxati, yangi xodim
- `GET/PUT/DELETE /api/users/[id]` — bitta xodim
- `GET/POST /api/specializations` — mutaxassisliklar
- `DELETE /api/specializations/[id]`

**Frontend (Farid):**
- `src/app/(dashboard)/staff/page.tsx` — xodimlar jadval + modal
- `src/app/(dashboard)/settings/page.tsx` — mutaxassisliklar boshqaruvi

**Business logic:**
- Yangi xodim yaratilganda parol bcrypt bilan hash qilinadi
- Faqat ADMIN ko'ra oladi va boshqara oladi
- Xodim o'chirilganda `isActive = false` (soft delete)

**Fayllar:**
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/specializations/route.ts`
- `src/app/api/specializations/[id]/route.ts`
- `src/app/(dashboard)/staff/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`

---

## Faza 2: Bemorlar va Uchrashuvlar

### Task 5: Bemorlar moduli (CRUD + qidirish)

**Maqsad:** Bemor ro'yxatdan o'tkazish, qidirish, tibbiy karta

**Backend (Botir):**
- `GET /api/patients` — ro'yxat (search: ism, telefon, JSHSHIR bo'yicha)
- `POST /api/patients` — yangi bemor
- `GET /api/patients/[id]` — bemor tafsiloti
- `PUT /api/patients/[id]` — yangilash
- `GET /api/patients/[id]/history` — uchrashuvlar tarixi
- `GET /api/patients/[id]/payments` — to'lovlar tarixi
- `GET /api/patients/[id]/records` — tibbiy karta

**Frontend (Farid):**
- `src/app/(dashboard)/patients/page.tsx` — ro'yxat + qidirish + yangi bemor modal
- `src/app/(dashboard)/patients/new/page.tsx` — batafsil forma
- `src/app/(dashboard)/patients/[id]/page.tsx` — tafsilot sahifasi (tarix, to'lov, karta)

**Fayllar:**
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/app/api/patients/[id]/history/route.ts`
- `src/app/api/patients/[id]/payments/route.ts`
- `src/app/api/patients/[id]/records/route.ts`
- `src/app/(dashboard)/patients/page.tsx`
- `src/app/(dashboard)/patients/new/page.tsx`
- `src/app/(dashboard)/patients/[id]/page.tsx`

---

### Task 6: Uchrashuvlar + Booking tizimi

**Maqsad:** Uchrashuv yaratish, shifokor jadvaliga qarab bo'sh vaqtlar

**Backend (Botir):**
- `GET /api/appointments` — filter: sana, shifokor, status
- `POST /api/appointments` — yangi uchrashuv + navbat raqami avtomatik
- `PUT /api/appointments/[id]` — status yangilash
- `DELETE /api/appointments/[id]` — bekor qilish
- `GET /api/appointments/available` — shifokor jadvaliga qarab bo'sh vaqtlar

**Frontend (Farid):**
- `src/app/(dashboard)/appointments/page.tsx` — kunlik jadval ko'rinishi
- `src/app/(dashboard)/appointments/new/page.tsx` — yangi uchrashuv forma

**Business logic:**
- Uchrashuv yaratilganda `Queue` yozuvi ham yaratiladi (queueNumber avtomatik)
- queueNumber: shu kunda o'sha shifokor uchun oxirgi raqam + 1

**Fayllar:**
- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/route.ts`
- `src/app/api/appointments/available/route.ts`
- `src/app/(dashboard)/appointments/page.tsx`
- `src/app/(dashboard)/appointments/new/page.tsx`

---

### Task 7: Navbat tizimi (Queue) + TV ekrani (SSE)

**Maqsad:** Navbat chaqirish va TV ekranda real-time ko'rsatish

**Backend (Botir):**
- `GET /api/queue` — joriy kun navbati
- `POST /api/queue/call-next` — keyingi bemorni chaqirish
- `GET /api/queue/display` — SSE stream (TV uchun)

**Frontend (Farid):**
- Appointments sahifasiga navbat chaqirish tugmasi
- `src/app/queue-display/page.tsx` — TV ekran sahifasi (fullscreen, yirik shrift)

**SSE pattern:**
```typescript
// src/app/api/queue/display/route.ts
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        const queue = await prisma.queue.findMany({
          where: { status: 'CALLED', appointment: { dateTime: { gte: startOfDay } } },
          include: { appointment: { include: { patient: true, doctor: true, room: true } } },
          orderBy: { calledAt: 'desc' },
          take: 5,
        });
        controller.enqueue(`data: ${JSON.stringify(queue)}\n\n`);
      };
      const interval = setInterval(send, 3000);
      send();
      return () => clearInterval(interval);
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  });
}
```

**Fayllar:**
- `src/app/api/queue/route.ts`
- `src/app/api/queue/call-next/route.ts`
- `src/app/api/queue/display/route.ts`
- `src/app/queue-display/page.tsx`

---

### Task 8: Xonalar va kravatlar boshqaruvi

**Maqsad:** Admin xona/krovat qo'shadi, statsionar uchun band qilish

**Backend (Botir):**
- `GET/POST /api/rooms` — xonalar
- `POST /api/rooms/[id]/beds` — krovat qo'shish
- `GET/PUT /api/beds/[id]` — krovat holati yangilash

**Frontend (Farid):**
- `src/app/(dashboard)/rooms/page.tsx` — xonalar + kravatlar ko'rinishi (floor bo'yicha)

**Fayllar:**
- `src/app/api/rooms/route.ts`
- `src/app/api/rooms/[id]/beds/route.ts`
- `src/app/api/beds/[id]/route.ts`
- `src/app/(dashboard)/rooms/page.tsx`

---

## Faza 3: Moliya va Laboratoriya

### Task 9: To'lovlar moduli

**Maqsad:** Barcha to'lov usullari, qarzlar, kvitansiya

**Backend (Botir):**
- `GET /api/payments` — filter: sana, usul, kategoriya, status
- `POST /api/payments` — yangi to'lov
- `GET /api/payments/[id]/receipt` — kvitansiya ma'lumotlari
- `GET /api/payments/debts` — to'lanmagan to'lovlar (PENDING/PARTIAL)

**Frontend (Farid):**
- `src/app/(dashboard)/payments/page.tsx` — to'lovlar ro'yxati + yangi to'lov modal
- Kvitansiya print button (window.print() yoki jsPDF)

**Fayllar:**
- `src/app/api/payments/route.ts`
- `src/app/api/payments/[id]/receipt/route.ts`
- `src/app/api/payments/debts/route.ts`
- `src/app/(dashboard)/payments/page.tsx`

---

### Task 10: Statsionar moduli (Admissions) + 12-soat qoidasi

**Maqsad:** Bemorni yotqizish, chiqarish, kunlik to'lov hisoblash

**Backend (Botir):**
- `POST /api/admissions` — bemorni yotqizish (bed.status = OCCUPIED)
- `PUT /api/admissions/[id]/discharge` — chiqarish + hisob-kitob
- `GET /api/admissions/[id]/bill` — statsionar hisob

**12-soat qoidasi (MUHIM):**
```typescript
function calculateInpatientDays(admissionDate: Date, dischargeDate: Date): number {
  const diffMs = dischargeDate.getTime() - admissionDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 12) return 0; // BEPUL
  return Math.ceil(diffHours / 24);
}
// Discharge da: days * dailyRate = umumiy statsionar to'lovi
// Bu to'lov Payment.create({ category: 'INPATIENT' }) bilan saqlanadi
```

**Frontend (Farid):**
- `src/app/(dashboard)/admissions/page.tsx` — statsionar bemorlar ro'yxati + yotqizish/chiqarish

**Fayllar:**
- `src/app/api/admissions/route.ts`
- `src/app/api/admissions/[id]/discharge/route.ts`
- `src/app/api/admissions/[id]/bill/route.ts`
- `src/app/(dashboard)/admissions/page.tsx`

---

### Task 11: Laboratoriya moduli

**Maqsad:** Tahlil qabul qilish, natijalar kiritish, PDF chop etish

**Backend (Botir):**
- `GET/POST /api/lab/tests` — tahlillar
- `PUT /api/lab/tests/[id]/results` — natija kiritish (status: COMPLETED)
- `GET /api/lab/tests/[id]/print` — chop etish ma'lumotlari
- `GET/POST /api/lab/test-types` — tahlil turlari

**Frontend (Farid):**
- `src/app/(dashboard)/lab/page.tsx` — tahlillar ro'yxati (status bo'yicha filter)
- `src/app/(dashboard)/lab/tests/[id]/page.tsx` — natija kiritish sahifasi

**Lab holati ketma-ketligi:**
```
PENDING → IN_PROGRESS → COMPLETED (orqaga yo'q)
```

**Fayllar:**
- `src/app/api/lab/tests/route.ts`
- `src/app/api/lab/tests/[id]/results/route.ts`
- `src/app/api/lab/tests/[id]/print/route.ts`
- `src/app/api/lab/test-types/route.ts`
- `src/app/(dashboard)/lab/page.tsx`
- `src/app/(dashboard)/lab/tests/[id]/page.tsx`

---

## Faza 4: Ombor va Hisobotlar

### Task 12: Dori ombori moduli

**Maqsad:** Dori kirim/chiqim, ogohlantirishlar, yetkazib beruvchilar

**Backend (Botir):**
- `GET/POST /api/medicines` — dorilar
- `PUT /api/medicines/[id]` — yangilash
- `POST /api/medicines/[id]/stock-in` — kirim
- `POST /api/medicines/[id]/stock-out` — chiqim (3 amal birgalikda!)
- `GET /api/medicines/alerts` — kam qolgan + muddati tugayotgan
- `GET/POST /api/suppliers` — yetkazib beruvchilar

**Dori chiqimida 3 amal BIRGALIKDA:**
```typescript
// 1. MedicineTransaction yaratish (STOCK_OUT)
await prisma.medicineTransaction.create({ data: { type: 'STOCK_OUT', ... } });
// 2. Medicine.quantity kamaytirish
await prisma.medicine.update({ where: { id }, data: { quantity: { decrement: qty } } });
// 3. Statsionar bemorga bo'lsa — Payment yaratish
if (admissionId) await prisma.payment.create({ data: { category: 'INPATIENT', amount: price * qty, ... } });
```

**Frontend (Farid):**
- `src/app/(dashboard)/pharmacy/page.tsx` — dorilar ro'yxati + kirim/chiqim modallari + ogohlantirishlar

**Fayllar:**
- `src/app/api/medicines/route.ts`
- `src/app/api/medicines/[id]/route.ts`
- `src/app/api/medicines/[id]/stock-in/route.ts`
- `src/app/api/medicines/[id]/stock-out/route.ts`
- `src/app/api/medicines/alerts/route.ts`
- `src/app/api/suppliers/route.ts`
- `src/app/(dashboard)/pharmacy/page.tsx`

---

### Task 13: Ish jadvali va Maosh hisoblash

**Maqsad:** Xodim ish jadvali, maosh belgilash

**Backend (Botir):**
- `GET/POST /api/schedules` — ish jadvallari
- `POST /api/salaries/calculate` — maosh hisoblash

**Frontend (Farid):**
- `src/app/(dashboard)/schedules/page.tsx` — haftalik jadval ko'rinishi
- `src/app/(dashboard)/salaries/page.tsx` — oylik maosh ro'yxati

**Fayllar:**
- `src/app/api/schedules/route.ts`
- `src/app/api/salaries/calculate/route.ts`
- `src/app/(dashboard)/schedules/page.tsx`
- `src/app/(dashboard)/salaries/page.tsx`

---

### Task 14: Hisobotlar moduli

**Maqsad:** Kunlik/oylik/yillik moliyaviy va statistik hisobotlar

**Backend (Botir):**
- `GET /api/reports/daily` — kunlik daromad
- `GET /api/reports/monthly` — oylik statistika
- `GET /api/reports/patients` — bemorlar statistikasi
- `GET /api/reports/medicines` — dori statistikasi
- `GET /api/reports/doctors` — shifokor ishlari
- `GET /api/reports/financial` — moliyaviy hisobot

**Frontend (Farid):**
- `src/app/(dashboard)/reports/page.tsx` — hisobot turi tanlash + natija jadval/grafik

**Fayllar:**
- `src/app/api/reports/[type]/route.ts`
- `src/app/(dashboard)/reports/page.tsx`

---

### Task 15: Audit log moduli

**Maqsad:** Barcha muhim harakatlarni qayd etish

**Backend (Botir):**
- `GET /api/audit-logs` — filter: user, modul, sana
- Har muhim API routeda `AuditLog.create()` qo'shish (patients, payments, medicines)

**Frontend (Farid):**
- `src/app/(dashboard)/audit/page.tsx` — audit log jadval + filter

**Fayllar:**
- `src/app/api/audit-logs/route.ts`
- `src/app/(dashboard)/audit/page.tsx`
- `src/lib/audit.ts` — helper: `createAuditLog(userId, action, module, details)`

---

## Faza 5: Integratsiyalar

### Task 16: Tibbiy karta + Retseptlar moduli

**Maqsad:** Shifokor yozuvlari, diagnoz, retsept

**Backend (Botir):**
- `GET/POST /api/medical-records` — tibbiy karta
- `POST /api/medical-records/[id]/prescriptions` — retsept qo'shish

**Frontend (Farid):**
- Bemor tafsilot sahifasiga tibbiy karta tab qo'shish
- Retsept forma + print button

**Fayllar:**
- `src/app/api/medical-records/route.ts`
- `src/app/api/medical-records/[id]/prescriptions/route.ts`

---

### Task 17: Telegram bot (alohida servis)

**Maqsad:** Bemorlar uchun navbat olish, tahlil natijasi, shifokorlar ro'yxati

**Steps:**
1. `telegram-bot/` papkasini yaratish
2. `telegram-bot/index.ts` — bot entry point
3. `telegram-bot/handlers/queue.ts` — navbat olish
4. `telegram-bot/handlers/results.ts` — tahlil natijasi ko'rish
5. `telegram-bot/handlers/doctors.ts` — shifokorlar ro'yxati
6. `POST /api/telegram/webhook` — webhook endpoint
7. `POST /api/telegram/send-result` — natija yuborish

**Bot ishlash tartibi:**
- Bemor telefon raqamini yuboradi
- Tizim raqamni DB dagi bemorlar bilan solishtiradi
- Tasdiqlangandan keyin funksiyalar ochiladi

**Fayllar:**
- `telegram-bot/index.ts`
- `telegram-bot/handlers/queue.ts`
- `telegram-bot/handlers/results.ts`
- `telegram-bot/handlers/doctors.ts`
- `src/app/api/telegram/webhook/route.ts`
- `src/app/api/telegram/send-result/route.ts`

---

### Task 18: Optimizatsiya va yakunlash

**Maqsad:** Performance, xavfsizlik, final test

**Steps:**
1. `npx tsc --noEmit` — TypeScript xatolarini yo'q qilish
2. `npm run lint` — ESLint
3. `npm run build` — production build
4. Barcha API routelarda RBAC tekshiruvini tasdiqlash
5. `prisma/seed.ts` — test ma'lumotlar (3 bemor, 2 shifokor, 5 dori)
6. `.env.example` yangilash
7. `README.md` yozish

---

## Umumiy arxitektura eslatmalari

### API Route pattern (har doim)
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// Rol tekshiruvi kerak bo'lsa:
if (!['ADMIN', 'HEAD_DOCTOR'].includes(session.user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Rang standartlari
| Holat | Tailwind |
|-------|----------|
| SCHEDULED / AVAILABLE / PAID / COMPLETED | `bg-green-100 text-green-800` |
| IN_PROGRESS / PARTIAL | `bg-yellow-100 text-yellow-800` |
| CANCELLED / OCCUPIED | `bg-red-100 text-red-800` |
| PENDING | `bg-slate-100 text-slate-800` |
| IN_QUEUE | `bg-blue-100 text-blue-800` |

### Tekshiruv ketma-ketligi (har task)
```
Backend Botir → Reviewer Ravshan → Frontend Farid → Reviewer Ravshan → QA Qadir
                                                                      ↓ (moliyaviy task bo'lsa)
                                                               Bughunter Bahodir
```
