#!/bin/bash
# ============================================================
#  Bolajon Klinika — VPS Deploy Skripti
#  Ishlatish: bash deploy.sh
# ============================================================
set -e

APP_DIR="/var/www/bolajon-klinika"
APP_PORT=3001
DOMAIN="www.bolajonklinika.uchqunai.uz"
DB_NAME="bolajon_clinic"
DB_USER="bolajon_user"
DB_PASS="BolajonDB2026!"
REPO="https://github.com/Mirfayz1993/bolajon-klinika.git"
NEXTAUTH_SECRET="bolajon-klinika-nextauth-secret-2026-production"

echo "============================================"
echo "  Bolajon Klinika — Deploy boshlandi"
echo "============================================"

# ── 1. Tizim yangilash ────────────────────────
echo "[1/9] Tizim yangilanmoqda..."
apt-get update -qq

# ── 2. Node.js 20 o'rnatish ───────────────────
if ! command -v node &>/dev/null; then
  echo "[2/9] Node.js 20 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/9] Node.js mavjud: $(node -v)"
fi

# ── 3. PM2, Git, nginx o'rnatish ──────────────
echo "[3/9] PM2, nginx, git o'rnatilmoqda..."
apt-get install -y nginx git certbot python3-certbot-nginx -qq
npm install -g pm2 --quiet

# ── 4. PostgreSQL o'rnatish ───────────────────
if ! command -v psql &>/dev/null; then
  echo "[4/9] PostgreSQL o'rnatilmoqda..."
  apt-get install -y postgresql postgresql-contrib -qq
  systemctl start postgresql
  systemctl enable postgresql
else
  echo "[4/9] PostgreSQL mavjud"
fi

# PostgreSQL DB va user yaratish
echo "[4/9] Database sozlanmoqda..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ── 5. Kodni yuklab olish ─────────────────────
echo "[5/9] Kod yuklanmoqda..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin master
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 6. .env fayl yaratish ─────────────────────
echo "[6/9] .env sozlanmoqda..."
cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
NEXTAUTH_URL="https://$DOMAIN"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NODE_ENV="production"
PORT=$APP_PORT
EOF

# ── 7. Dependencylar va build ─────────────────
echo "[7/9] npm install va build..."
cd "$APP_DIR"
npm ci --production=false
npx prisma generate
npx prisma db push --accept-data-loss
npm run build

# Seed (admin user yaratish) — faqat birinchi marta
npx ts-node --project tsconfig.json -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function main() {
  const p = new PrismaClient();
  const exists = await p.user.findFirst({ where: { role: 'ADMIN' } });
  if (!exists) {
    const hash = await bcrypt.hash('Admin1234!', 10);
    await p.user.create({ data: { name: 'Admin', phone: '+998900000000', password: hash, role: 'ADMIN' } });
    console.log('Admin yaratildi: +998900000000 / Admin1234!');
  } else { console.log('Admin allaqachon mavjud'); }
  await p.\\$disconnect();
}" 2>/dev/null || true

# ── 8. PM2 bilan ishga tushirish ──────────────
echo "[8/9] PM2 sozlanmoqda..."
pm2 delete bolajon-klinika 2>/dev/null || true
pm2 start npm --name "bolajon-klinika" -- start -- --port $APP_PORT
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

# ── 9. Nginx konfiguratsiya ───────────────────
echo "[9/9] Nginx sozlanmoqda..."
cat > /etc/nginx/sites-available/bolajon-klinika <<NGINX
server {
    listen 80;
    server_name $DOMAIN bolajonklinika.uchqunai.uz;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bolajon-klinika /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# ── SSL sertifikat ────────────────────────────
echo "SSL sertifikat olish..."
certbot --nginx -d $DOMAIN -d bolajonklinika.uchqunai.uz \
  --non-interactive --agree-tos --email admin@bolajonklinika.uz \
  --redirect 2>/dev/null || echo "SSL hozircha o'tkazildi (DNS tayyor bo'lsa qayta ishlating)"

echo ""
echo "============================================"
echo "  DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
echo "============================================"
echo "  URL:    https://$DOMAIN"
echo "  Port:   $APP_PORT"
echo "  DB:     $DB_NAME"
echo ""
echo "  Admin login:"
echo "  Telefon: +998900000000"
echo "  Parol:   Admin1234!"
echo "============================================"
pm2 status
