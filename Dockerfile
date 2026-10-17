FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml trägt die overrides/onlyBuiltDependencies (seit #248);
# ohne sie bricht der frozen-lockfile-Install mit LOCKFILE_CONFIG_MISMATCH ab.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG PUBLIC_GA_MEASUREMENT_ID
ENV PUBLIC_GA_MEASUREMENT_ID=$PUBLIC_GA_MEASUREMENT_ID
# Kurz-SHA des Deploys für die Betriebszeile im Footer (optional, kein Geheimnis).
ARG PUBLIC_BUILD_SHA
ENV PUBLIC_BUILD_SHA=$PUBLIC_BUILD_SHA
ENV NODE_ENV=production

RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
RUN corepack enable \
  && addgroup -S app \
  && adduser -S app -G app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --prod --frozen-lockfile
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/db/migrations ./db/migrations
COPY --from=builder --chown=app:app /app/scripts/run-postgres-migrations.mjs ./scripts/run-postgres-migrations.mjs
COPY --from=builder --chown=app:app /app/scripts/seed-admin.mjs ./scripts/seed-admin.mjs
COPY --from=builder --chown=app:app /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod 755 ./scripts/entrypoint.sh
USER app
EXPOSE 3000
# node:22-alpine hat weder curl noch wget standardmäßig — Check läuft über
# Node selbst (globales fetch, seit Node 18) mit explizitem Exit-Code.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
