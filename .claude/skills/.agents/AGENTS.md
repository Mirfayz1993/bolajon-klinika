# Bolajon Klinika CMS — Agent Jamoasi

## Jamoa tarkibi

```
┌─────────────────────────────────────────────────────┐
│                PM SARDOR (Opus)                      │
│           Boshqaruvchi / Controller                  │
├──────────┬──────────┬───────────┬────────┬──────────┤
│ Backend  │ Frontend │ Reviewer  │ QA     │ Bughunter│
│ BOTIR    │ FARID    │ RAVSHAN   │ QADIR  │ BAHODIR  │
│ (Sonnet) │ (Sonnet) │ (Haiku)   │(Sonnet)│ (Sonnet) │
└──────────┴──────────┴───────────┴────────┴──────────┘
```

## Ish tartibi (har task uchun)

```
PM Sardor
  │
  ├── 1. Backend Botir → implement → hisobot
  │   └── 2. Reviewer Ravshan → spec check → ✅/❌
  │       └── (❌ bo'lsa → Botir tuzatadi → Ravshan qayta tekshiradi)
  │
  ├── 3. Frontend Farid → implement → hisobot
  │   └── 4. Reviewer Ravshan → spec check → ✅/❌
  │       └── (❌ bo'lsa → Farid tuzatadi → Ravshan qayta tekshiradi)
  │
  ├── 5. QA Qadir → TypeScript + lint + build verify → ✅/❌
  │   └── (❌ bo'lsa → tegishli agent tuzatadi → Qadir qayta tekshiradi)
  │
  └── 6. Bughunter Bahodir → moliyaviy logic + silent failures → ✅/❌
      └── (❌ bo'lsa → tegishli agent tuzatadi → Bahodir qayta tekshiradi)
          └── ✅ TASK COMPLETE
```

## Agent fayllari

| Agent | Profil | Mas'uliyat |
|-------|--------|------------|
| PM Sardor | `.agents/profiles/pm-sardor/AGENT.md` | Boshqaruv, task dispatch, reja |
| Backend Botir | `.agents/profiles/backend-botir/AGENT.md` | API Routes, Prisma, business logic |
| Frontend Farid | `.agents/profiles/frontend-farid/AGENT.md` | Next.js sahifalar, Tailwind, i18n |
| Reviewer Ravshan | `.agents/profiles/reviewer-ravshan/AGENT.md` | Spec compliance tekshirish |
| QA Qadir | `.agents/profiles/qa-qadir/AGENT.md` | TypeScript, lint, build verify |
| Bughunter Bahodir | `.agents/profiles/bughunter-bahodir/AGENT.md` | Klinika business logic buglar |

## Dispatch qoidalari

1. **Bir vaqtda faqat 1 ta implementer** ishlaydi (conflict oldini olish)
2. **Backend → Frontend** ketma-ketlikda (frontend API ga bog'liq)
3. **Review o'tkazilmasa** — keyingi qadamga o'tish MUMKIN EMAS
4. **3 marta qaytarish** — PM taskni maydalaydi yoki insonga murojaat qiladi
5. **BLOCKED** — PM hal qiladi yoki insonga murojaat qiladi

## Loyiha ma'lumotlari

- **Loyiha:** `C:\Users\user\Desktop\bolajon klinika\clinic-cms`
- **Reja:** `docs/plans/implementation-plan.md`
- **Tech:** Next.js 14 + TypeScript + Tailwind CSS + Prisma ORM + PostgreSQL
- **Auth:** NextAuth.js (RBAC — 11 rol)
- **API:** Next.js API Routes (`src/app/api/...`)
- **Real-time:** SSE (Server-Sent Events) — TV navbat ekrani uchun
- **Telegram:** Alohida servis (`telegram-bot/`)
- **DB schema:** `prisma/schema.prisma` (20 jadval)
- **i18n:** O'zbekcha — Lotin (`uz-latin.json`) va Kirill (`uz-cyrillic.json`)
- **Faza 1 (hozir):** Auth + Admin panel + Bemorlar + Uchrashuvlar

## Texnologiyalar xulosa

| Texnologiya | Ishlatish joyi |
|-------------|----------------|
| `prisma.model.findMany()` | DB dan ro'yxat olish |
| `prisma.model.create()` | Yangi yozuv |
| `prisma.model.update()` | Yangilash |
| `prisma.model.delete()` | O'chirish |
| `getServerSession(authOptions)` | API routeda sessiya tekshirish |
| `"use client"` | Client komponentlar |
| Tailwind CSS | Barcha styling |
| Lucide React | Ikonkalar |
