# syntax=docker/dockerfile:1

# Debian slim rather than Alpine: Prisma's engines need OpenSSL, and glibc avoids musl surprises.
FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npx prisma generate && npm run build

# Production dependencies only; the Prisma CLI stays because the container runs migrations on start.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-fund --no-audit && npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Migrations and the idempotent seed run before the server accepts traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/database/seed.js && node dist/main.js"]
