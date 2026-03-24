# Refactor (Next.js + TypeScript)

## Qadamlar

1. O'zgartirilayotgan kodni to'liq o'qi
2. Bog'liq fayllarni aniqla (import/export chain)
3. Minimal o'zgartirish bilan refactor qil
4. Hech qanday funksionallikni o'zgartirma

## Prinsiplar

- Takrorlanuvchi fetch logic → custom hook ga chiqar (`src/hooks/use[Modul].ts`)
- Takrorlanuvchi UI (modal, jadval) → `src/components/ui/` ga chiqar
- Katta komponent → kichik komponentlarga bo'l (faqat 200+ qator bo'lsa)
- `any` type → aniq interface bilan almashtir
- Inline style → Tailwind class bilan almashtir

## Qoidalar

- Ishlayotgan kodni BUZMA
- TypeScript check: `npx tsc --noEmit`
- Lint check: `npm run lint`
- Faqat kerakli o'zgarishlarni qil, ortiqcha "yaxshilash" QILMA
- `prisma` ni frontend komponentga import qilma — hech qachon
