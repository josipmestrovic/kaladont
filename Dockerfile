# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app
ENV CI=true

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.js ./
COPY aplikacije/web/package.json aplikacije/web/package.json
COPY aplikacije/posluzitelj/package.json aplikacije/posluzitelj/package.json
COPY paketi/zajednicko/package.json paketi/zajednicko/package.json
COPY skripte/uvoz-rjecnika/package.json skripte/uvoz-rjecnika/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm deploy --filter posluzitelj /runtime

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S --gid 1000 kaladont \
  && adduser -S --uid 1000 --ingroup kaladont kaladont

COPY --from=builder --chown=kaladont:kaladont /runtime ./
COPY --from=builder --chown=kaladont:kaladont /app/aplikacije/posluzitelj/dist ./dist
COPY --from=builder --chown=kaladont:kaladont /app/aplikacije/posluzitelj/src/baza/migracije ./src/baza/migracije
COPY --from=builder --chown=kaladont:kaladont /app/aplikacije/posluzitelj/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=kaladont:kaladont /app/aplikacije/web/build /app/web/build

LABEL org.opencontainers.image.title="Kaladont"
LABEL org.opencontainers.image.description="Hrvatska višeigračka igra riječi"
LABEL org.opencontainers.image.source="https://github.com/josipmestrovic/kaladont"

USER kaladont
EXPOSE 3000

CMD ["node", "dist/index.js"]
