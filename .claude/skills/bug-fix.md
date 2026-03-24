# Bug tuzatish (Next.js + Prisma + Klinika)

## Qadamlar

1. Xatoni aniqla — browser console / network tab / terminal xatolarni o'qi
2. Tegishli faylni top va o'qi
3. Root cause ni aniqla
4. Minimal o'zgartirish bilan tuzat
5. Bog'liq joylarni tekshir (Prisma schema ↔ API Route ↔ Frontend fetch)

## Tekshirish ro'yxati

- [ ] Prisma model field nomlari API va frontend bilan mos kelayaptimi?
- [ ] API Route da `getServerSession()` bormi?
- [ ] `fetch` URL to'g'rimi? (`/api/patients`, `/api/patients/${id}`)
- [ ] `Content-Type: application/json` header bormi (POST/PUT da)?
- [ ] Prisma `include` yoki `select` yetishmayaptimi?
- [ ] TypeScript `any` type xatosimi?
- [ ] `useEffect` dependency array to'g'rimi?
- [ ] Modal `z-index` muammosimi? (`z-50` qo'sh)
- [ ] Date formatlar to'g'rimi? (`new Date().toISOString()`)

## Tez-tez uchraydigan muammolar

| Muammo | Sabab | Yechim |
|--------|-------|--------|
| API 401 qaytaradi | Session yo'q | `getServerSession()` check |
| API 404 qaytaradi | URL xato | `fetch('/api/...')` URLni tekshir |
| Prisma xato: "field required" | Majburiy maydon uzatilmagan | Request body tekshir |
| Prisma xato: "Record not found" | ID noto'g'ri | `findFirst` → null check |
| Frontend ma'lumot kelmaydi | `useEffect` dependency yetishmaydi | Array ga o'zgaruvchi qo'sh |
| Modal ko'rinmaydi | z-index muammo | `z-50` yoki undan yuqori |
| TypeScript xato: `any` | Type aniqlanmagan | Interface yarat |
| Statsionar hisob xato | 12-soat qoidasi yo'q | `calculateInpatientDays()` tekshir |

## Klinika-spetsifik tekshirish

```typescript
// Statsionar to'lov: 12-soat qoidasi bormi?
const diffHours = (discharge - admission) / (1000 * 60 * 60);
if (diffHours <= 12) return 0; // bepul bo'lishi kerak

// Dori chiqimida uchta amal birgami?
// 1. MedicineTransaction.create (STOCK_OUT)
// 2. Medicine.update (quantity decrement)
// 3. Payment.create (statsionar to'lovga qo'shish)
```
