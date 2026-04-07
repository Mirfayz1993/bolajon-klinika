# ─── Build bosqichi ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Paketlarni nusxalash va o'rnatish
COPY package*.json ./
RUN npm ci

# Prisma schemani nusxalash (generate uchun kerak)
COPY prisma ./prisma
RUN npx prisma generate

# Qolgan manba kodini nusxalash
COPY . .

# Next.js ni build qilish
RUN npm run build

# ─── Production bosqichi ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Faqat kerakli fayllarni ko'chirish
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
