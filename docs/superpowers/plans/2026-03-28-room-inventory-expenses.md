# Room Inventory, Javobgar & Xarajatlar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Har bir xonaga inventar (jihozlar), javobgar shaxs va 3 xil xarajat turini boshqarish imkonini berish.

**Architecture:**
- 3 ta yangi Prisma modeli: `RoomInventoryItem`, `RoomResponsible`, `RoomExpense`
- Har bir xona uchun dedicated sahifa `/rooms/[id]` — 4 tabli (Karavotlar, Inventar, Xarajatlar, Sozlamalar)
- Barcha API routes `/api/rooms/[id]/...` pattern bo'yicha
- Rooms list sahifasida "Ko'rish" tugmasi modalni ochish o'rniga `/rooms/[id]` ga navigate qiladi

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, PostgreSQL, Tailwind CSS, Lucide React, useLanguage i18n hook

---

## Holat (2026-03-28)

**Allaqachon bajarilgan:**
- `prisma/schema.prisma` ga `RoomInventoryStatus` va `RoomExpenseType` enumlari qo'shilgan
- Rooms sahifasida dinamik room types (API dan) ishlayapti

**Bajarilishi kerak:**
- Schema: 3 ta model + relations
- API: 7 ta endpoint
- UI: `/rooms/[id]` sahifasi
- i18n: 30+ kalit
- Rooms list: navigation update

---

## File Structure

### Yaratiladigan fayllar:
```
src/app/(dashboard)/rooms/[id]/page.tsx          ← Xona detail sahifasi (4 tab)
src/app/api/rooms/[id]/inventory/route.ts         ← GET list + POST add
src/app/api/rooms/[id]/inventory/[itemId]/route.ts ← PUT edit + DELETE
src/app/api/rooms/[id]/responsible/route.ts       ← GET + PUT
src/app/api/rooms/[id]/expenses/route.ts          ← GET list + POST add
src/app/api/rooms/[id]/expenses/[expenseId]/route.ts ← DELETE
```

### O'zgartiriladigan fayllar:
```
prisma/schema.prisma                              ← 3 model + relations qo'shish
src/app/(dashboard)/rooms/page.tsx                ← "Ko'rish" → router.push('/rooms/[id]')
public/locales/uz-latin.json                      ← yangi kalitlar
public/locales/uz-cyrillic.json                   ← yangi kalitlar
src/config/nav-pages.ts                           ← /rooms/[id] qo'shish (ixtiyoriy)
```

---

## Task 1: Prisma Schema — 3 ta model qo'shish

**Files:**
- Modify: `prisma/schema.prisma`

### Schema qo'shiladigan qism:

```prisma
model RoomInventoryItem {
  id           String              @id @default(cuid())
  roomId       String
  name         String
  description  String?
  quantity     Int                 @default(1)
  unitPrice    Decimal?            @db.Decimal(12, 2)
  purchaseDate DateTime            @default(now())
  status       RoomInventoryStatus @default(ACTIVE)
  addedById    String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  room    Room  @relation(fields: [roomId], references: [id])
  addedBy User? @relation("InventoryAddedBy", fields: [addedById], references: [id])

  @@map("room_inventory_items")
}

model RoomResponsible {
  id           String   @id @default(cuid())
  roomId       String   @unique
  userId       String
  assignedAt   DateTime @default(now())
  assignedById String?

  room       Room  @relation(fields: [roomId], references: [id])
  user       User  @relation("RoomResponsibleUser", fields: [userId], references: [id])
  assignedBy User? @relation("RoomResponsibleAssignedBy", fields: [assignedById], references: [id])

  @@map("room_responsibles")
}

model RoomExpense {
  id          String          @id @default(cuid())
  roomId      String
  type        RoomExpenseType
  amount      Decimal         @db.Decimal(12, 2)
  description String?
  date        DateTime        @default(now())
  createdById String?
  createdAt   DateTime        @default(now())

  room      Room  @relation(fields: [roomId], references: [id])
  createdBy User? @relation("ExpenseCreatedBy", fields: [createdById], references: [id])

  @@map("room_expenses")
}
```

### Room modeliga qo'shiladigan relations:
```prisma
  inventory   RoomInventoryItem[]
  responsible RoomResponsible?
  expenses    RoomExpense[]
```

### User modeliga qo'shiladigan relations:
```prisma
  inventoryAdded   RoomInventoryItem[] @relation("InventoryAddedBy")
  roomResponsible  RoomResponsible[]   @relation("RoomResponsibleUser")
  roomsAssigned    RoomResponsible[]   @relation("RoomResponsibleAssignedBy")
  roomExpenses     RoomExpense[]       @relation("ExpenseCreatedBy")
```

- [ ] **Step 1:** `prisma/schema.prisma` ga 3 ta model qo'sh (Room va User ga relations ham)
- [ ] **Step 2:** Dev serverni to'xtat (port 3000 ni bo'shat)
- [ ] **Step 3:** `npx prisma db push` — bazaga tatbiq et
- [ ] **Step 4:** `npx prisma generate` — TypeScript client yangilash
- [ ] **Step 5:** Dev serverni qayta ishga tushir

---

## Task 2: API — Inventory endpoints

**Files:**
- Create: `src/app/api/rooms/[id]/inventory/route.ts`
- Create: `src/app/api/rooms/[id]/inventory/[itemId]/route.ts`

### `/api/rooms/[id]/inventory` — GET + POST

```typescript
// GET: xona inventarini ro'yxati
// POST: yangi inventar qo'shish (ADMIN only)
// Body: { name, description?, quantity?, unitPrice?, purchaseDate? }
// Validatsiya: name majburiy, quantity >= 1
```

### `/api/rooms/[id]/inventory/[itemId]` — PUT + DELETE

```typescript
// PUT: inventarni tahrirlash (ADMIN only)
// Body: { name?, description?, quantity?, unitPrice?, status? }
// DELETE: o'chirish — faqat WRITTEN_OFF bo'lsa yoki quantity=0
// Yoki: statusni WRITTEN_OFF ga o'tkazish (soft delete)
```

**Pattern (CLAUDE.md bo'yicha):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = await prisma.roomInventoryItem.findMany({
      where: { roomId: id },
      include: { addedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

- [ ] **Step 1:** `src/app/api/rooms/[id]/inventory/route.ts` yarat — GET + POST
- [ ] **Step 2:** `src/app/api/rooms/[id]/inventory/[itemId]/route.ts` yarat — PUT + DELETE
- [ ] **Step 3:** curl bilan test: `GET /api/rooms/{roomId}/inventory`

---

## Task 3: API — Responsible endpoint

**Files:**
- Create: `src/app/api/rooms/[id]/responsible/route.ts`

```typescript
// GET: xona javobgarini olish
//   Response: { responsible: { id, userId, user: { name, role }, assignedAt } | null }
// PUT: javobgar tayinlash yoki almashtirish (ADMIN only)
//   Body: { userId: string }
//   Logic: upsert (agar bor bo'lsa update, bo'lmasa create)
```

- [ ] **Step 1:** `src/app/api/rooms/[id]/responsible/route.ts` yarat — GET + PUT
- [ ] **Step 2:** curl bilan test

---

## Task 4: API — Expenses endpoints

**Files:**
- Create: `src/app/api/rooms/[id]/expenses/route.ts`
- Create: `src/app/api/rooms/[id]/expenses/[expenseId]/route.ts`

```typescript
// GET: xarajatlar ro'yxati, ?type=INVENTORY|MEDICINE|UTILITY filter
//   Response: { expenses: [...], totals: { INVENTORY: n, MEDICINE: n, UTILITY: n, all: n } }
// POST: yangi xarajat qo'shish (ADMIN only)
//   Body: { type: RoomExpenseType, amount: number, description?: string, date?: string }
//   Validatsiya: type, amount majburiy; amount > 0
// DELETE /[expenseId]: o'chirish (ADMIN only)
```

- [ ] **Step 1:** `src/app/api/rooms/[id]/expenses/route.ts` yarat — GET + POST
- [ ] **Step 2:** `src/app/api/rooms/[id]/expenses/[expenseId]/route.ts` yarat — DELETE
- [ ] **Step 3:** curl bilan test

---

## Task 5: i18n — Yangi kalitlar

**Files:**
- Modify: `public/locales/uz-latin.json`
- Modify: `public/locales/uz-cyrillic.json`

### `rooms` bo'limiga qo'shiladigan kalitlar (uz-latin):
```json
"viewDetails": "Batafsil ko'rish",
"inventory": "Inventar",
"addInventory": "Inventar qo'shish",
"inventoryName": "Jihoz nomi",
"inventoryDescription": "Tavsif",
"inventoryQuantity": "Miqdor",
"inventoryUnitPrice": "Birlik narxi",
"inventoryStatus": "Holat",
"inventoryActive": "Faol",
"inventoryWrittenOff": "Chiqim qilingan",
"writeOff": "Chiqim qilish",
"purchaseDate": "Sotib olingan sana",
"noInventory": "Inventar mavjud emas",
"responsible": "Javobgar",
"assignResponsible": "Javobgar tayinlash",
"changeResponsible": "Javobgarni almashtirish",
"noResponsible": "Javobgar tayinlanmagan",
"currentResponsible": "Hozirgi javobgar",
"expenses": "Xarajatlar",
"addExpense": "Xarajat qo'shish",
"expenseType": "Xarajat turi",
"expenseAmount": "Miqdori (so'm)",
"expenseDescription": "Izoh",
"expenseDate": "Sana",
"expenseINVENTORY": "Inventar xarajati",
"expenseMEDICINE": "Dori / Reaktor",
"expenseUTILITY": "Maishiy xarajat",
"noExpenses": "Xarajatlar mavjud emas",
"totalExpenses": "Jami xarajatlar",
"expensesByType": "Turlari bo'yicha",
"backToRooms": "Xonalarga qaytish",
"roomInfo": "Xona ma'lumotlari",
"overview": "Umumiy ko'rinish"
```

### uz-cyrillic kalitlari (kirill):
```json
"viewDetails": "Батафсил кўриш",
"inventory": "Инвентар",
"addInventory": "Инвентар қўшиш",
"inventoryName": "Жиҳоз номи",
"inventoryDescription": "Тавсиф",
"inventoryQuantity": "Миқдор",
"inventoryUnitPrice": "Бирлик нархи",
"inventoryStatus": "Ҳолат",
"inventoryActive": "Фаол",
"inventoryWrittenOff": "Чиқим қилинган",
"writeOff": "Чиқим қилиш",
"purchaseDate": "Сотиб олинган сана",
"noInventory": "Инвентар мавжуд эмас",
"responsible": "Жавобгар",
"assignResponsible": "Жавобгар тайинлаш",
"changeResponsible": "Жавобгарни алмаштириш",
"noResponsible": "Жавобгар тайинланмаган",
"currentResponsible": "Ҳозирги жавобгар",
"expenses": "Харажатлар",
"addExpense": "Харажат қўшиш",
"expenseType": "Харажат тури",
"expenseAmount": "Миқдори (сўм)",
"expenseDescription": "Изоҳ",
"expenseDate": "Сана",
"expenseINVENTORY": "Инвентар харажати",
"expenseMEDICINE": "Дори / Реактор",
"expenseUTILITY": "Маиший харажат",
"noExpenses": "Харажатлар мавжуд эмас",
"totalExpenses": "Жами харажатлар",
"expensesByType": "Турлари бўйича",
"backToRooms": "Хоналарга қайтиш",
"roomInfo": "Хона маълумотлари",
"overview": "Умумий кўриниш"
```

- [ ] **Step 1:** `uz-latin.json` rooms bo'limiga kalitlar qo'sh
- [ ] **Step 2:** `uz-cyrillic.json` rooms bo'limiga kirill kalitlar qo'sh

---

## Task 6: UI — `/rooms/[id]` sahifasi

**Files:**
- Create: `src/app/(dashboard)/rooms/[id]/page.tsx`

### Sahifa strukturasi:

```
Header: "← Xonalarga qaytish" | "Xona №{number} — {type}" | Tahrirlash tugmasi
Responsible pill: "Javobgar: [name]" yoki "Javobgar tayinlanmagan"

Tabs: [Karavotlar] [Inventar] [Xarajatlar] [Sozlamalar]

Tab 1 — Karavotlar:
  - Mavjud detail modal kontentini shu yerga ko'chirish
  - Karavot qo'shish, o'chirish, status o'zgartirish

Tab 2 — Inventar:
  - Jadval: Jihoz nomi | Tavsif | Miqdor | Narxi | Sana | Holat | Amallar
  - "Inventar qo'shish" tugma → inline form (modal ichida)
  - ACTIVE items: "Chiqim qilish" tugma → status WRITTEN_OFF ga o'tkazish
  - Badge: ACTIVE = green, WRITTEN_OFF = red

Tab 3 — Xarajatlar:
  - Yuqorida: 3 ta summary card (Inventar / Dori / Maishiy jami summa)
  - Filter: Barcha | Inventar | Dori/Reaktor | Maishiy
  - Jadval: Tur | Izoh | Miqdor | Sana | O'chirish
  - "Xarajat qo'shish" tugma → modal (type select, amount, description, date)

Tab 4 — Sozlamalar:
  - Javobgar bo'limi:
    - Hozirgi javobgar: [avatar] [name] [role]
    - "Tayinlash / Almashtirish" tugma → staff select dropdown
  - (Kelajakda: xona parametrlari)
```

### Komponent state:
```typescript
const [tab, setTab] = useState<'beds' | 'inventory' | 'expenses' | 'settings'>('beds');
const [room, setRoom] = useState<RoomDetail | null>(null);
const [inventory, setInventory] = useState<InventoryItem[]>([]);
const [expenses, setExpenses] = useState<Expense[]>([]);
const [responsible, setResponsible] = useState<Responsible | null>(null);
const [expenseFilter, setExpenseFilter] = useState<string>('ALL');
```

### Data fetching:
```typescript
// Sahifa ochilganda:
fetchRoom()      → GET /api/rooms/${id}
fetchInventory() → GET /api/rooms/${id}/inventory
fetchExpenses()  → GET /api/rooms/${id}/expenses
fetchResponsible() → GET /api/rooms/${id}/responsible
```

- [ ] **Step 1:** `src/app/(dashboard)/rooms/[id]/page.tsx` yarat — skeleton + tab navigation
- [ ] **Step 2:** Karavotlar tab — rooms page dagi detail modal logikasini ko'chir
- [ ] **Step 3:** Inventar tab — jadval + qo'shish formasi + chiqim qilish
- [ ] **Step 4:** Xarajatlar tab — summary cards + jadval + qo'shish modal
- [ ] **Step 5:** Sozlamalar tab — javobgar tayinlash (staff list dan select)
- [ ] **Step 6:** Sahifani `router.push` bilan `/rooms/[id]` ga yo'naltirish

---

## Task 7: Rooms List — Navigation update

**Files:**
- Modify: `src/app/(dashboard)/rooms/page.tsx`

```typescript
// Qo'shish: import { useRouter } from 'next/navigation';
// O'zgartirish: "Ko'rish" tugmasi onClick
// Eski: onClick={() => fetchDetailRoom(room.id)}  (modal ochadi)
// Yangi: onClick={() => router.push(`/rooms/${room.id}`)}
// Detail modal state va handler larni olib tashlash (agar kerak bo'lmasa)
```

- [ ] **Step 1:** `useRouter` import qil, "Ko'rish" tugmasini `router.push` ga o'tkazish
- [ ] **Step 2:** Eski detail modal state/handler larini tozalash

---

## Task 8 (ixtiyoriy): nav-pages.ts yangilash

**Files:**
- Modify: `src/config/nav-pages.ts`

```typescript
// Mavjud: { path: '/rooms', label: 'Xonalar' }
// Qo'shish:
{ path: '/rooms/:id', label: 'Xona tafsiloti',
  actions: [
    { key: 'inventory:add', label: 'Inventar qo\'shish' },
    { key: 'inventory:writeoff', label: 'Chiqim qilish' },
    { key: 'expenses:add', label: 'Xarajat qo\'shish' },
    { key: 'responsible:assign', label: 'Javobgar tayinlash' },
  ]
}
```

- [ ] **Step 1:** nav-pages.ts ga `/rooms/:id` entry qo'sh

---

## Muhim cheklovlar (CONSTRAINTS)

1. **Prisma faqat API Routes da** — frontend da hech qachon
2. **Har API da `getServerSession()`** — istisnossiz
3. **ADMIN roli tekshiruvi** — yozish/o'chirish amallarida
4. **Next.js 16 async params** — `const { id } = await params;` pattern
5. **`useLanguage()` hook** — barcha matns uchun, hardcode YOZMA
6. **Tailwind CSS** — inline style QILMA (faqat runtime dynamic width uchun)
7. **Lucide React** ikonkalar
8. **`try/catch` + `NextResponse.json({ error }, { status })`** — har API da

---

## Dispatch tartibi

```
Task 1 (Schema) → Backend Botir
Task 2 (Inventory API) → Backend Botir → Ravshan
Task 3 (Responsible API) → Backend Botir → Ravshan
Task 4 (Expenses API) → Backend Botir → Ravshan
Task 5 (i18n) → Frontend Farid
Task 6 (UI /rooms/[id]) → Frontend Farid → Ravshan
Task 7 (Rooms list update) → Frontend Farid → Ravshan
Task 8 (nav-pages) → Frontend Farid
Yakuniy → QA Qadir
```
