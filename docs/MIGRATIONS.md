# Prisma Migrations Workflow

Loyiha endi **versiyalangan migration**'lardan foydalanadi (`prisma migrate`),
oldingi `prisma db push --accept-data-loss` o'rniga.

## Lokal'da yangi schema o'zgartirish kiritganda

```bash
# 1. prisma/schema.prisma'ga o'zgartirish kiriting
# 2. Yangi migration yarating va lokal DB'ga apply qiling:
npx prisma migrate dev --name <qisqacha_tavsif>
# 3. Yaratilgan prisma/migrations/<timestamp>_<name>/migration.sql faylini git'ga qo'shing
git add prisma/migrations/
git commit -m "migrate: <tavsif>"
```

## Production'ga deploy

```bash
# Mavjud va yangi barcha migration'larni apply qiladi (idempotent — qayta apply qilmaydi)
npx prisma migrate deploy
# Keyin client generate va build:
npx prisma generate
npm run build
pm2 restart bolajon-klinika
```

> **MUHIM:** `prisma db push --accept-data-loss` BUNDAN BUYON ISHLATILMAYDI — u
> migration tarixini chetlab o'tadi va data yo'qotishga olib keladi.

## Birinchi marta production baseline

Agar production DB allaqachon `db push` orqali yangilangan va migration tarixi yo'q bo'lsa,
**bir martalik** quyidagi qadamlarni bajarish kerak:

```bash
# Server'da (bir martalik):
cd /var/www/bolajon-klinika

# 1. _prisma_migrations jadvalini yaratish (agar yo'q bo'lsa)
# 2. Mavjud migration'larni "applied" deb belgilash:
for m in 20260324123040_init 20260324123621_fix_relations_and_enums \
         20260327050858_add_role_permission 20260327071406_make_jshshir_optional \
         20260413_lab_panel 20260426220000_vitals_inventory_floor_lab_normals; do
  npx prisma migrate resolve --applied "$m"
done

# 3. Keyingi deploy'larda oddiy migrate deploy ishlaydi:
npx prisma migrate deploy
```

## Migration tarixi git'da

`prisma/migrations/` papkasi endi git'da kuzatiladi. Har bir migration:
- `migration.sql` — Prisma tomonidan yaratilgan SQL
- Manually edit qilmang — buzilgan migration'ni qaytarib bo'lmaydi
- Schema o'zgargandan keyin **doimo** yangi migration yarating, eski faylni o'zgartirmang

## CI/CD'da migration tekshiruvi

GitHub Actions'da deploy bosqichi (kelajakda) avtomatik:
1. Migration fayllar git'da bor-yo'qligini tekshiradi
2. `prisma migrate deploy` ishlatadi
3. Build + restart

## Backup tavsiyasi

Har deploy oldidan production DB backup oling:
```bash
pg_dump -U postgres clinic_cms > backup_$(date +%Y%m%d_%H%M%S).sql
```
