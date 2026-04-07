#!/bin/bash
# Yangilanishlarni VPS ga yuklash (keyingi marta ishlatish uchun)
set -e
APP_DIR="/var/www/bolajon-klinika"

echo "Yangilanish boshlanmoqda..."
cd "$APP_DIR"
git pull origin master
npm ci --production=false
npx prisma generate
npx prisma db push --accept-data-loss
npm run build
pm2 restart bolajon-klinika
echo "Yangilanish tayyor!"
pm2 status
