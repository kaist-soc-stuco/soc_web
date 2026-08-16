# syntax=docker/dockerfile:1.7

FROM node:22.14.0-alpine3.21 AS base

WORKDIR /app
RUN apk add --no-cache bash \
  && corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY shared/common/package.json shared/common/package.json
COPY shared/contracts/package.json shared/contracts/package.json
COPY shared/config/package.json shared/config/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY shared/common shared/common
COPY shared/contracts shared/contracts
COPY shared/config shared/config
COPY infra/scripts infra/scripts

FROM base AS build
RUN pnpm --filter @soc/shared build \
  && pnpm --filter @soc/api build

# Migration and retention jobs intentionally use this target because they need
# drizzle-kit/ts-node and the source tree. The serving image below does not.
FROM build AS maintenance

FROM build AS production-deps
RUN pnpm --filter @soc/api deploy --prod --legacy /prod/api \
  && rm -rf /prod/api/src /prod/api/test /prod/api/drizzle \
  && rm -f /prod/api/dist/dev-main.js \
    /prod/api/dist/features/auth/development-auth.controller.js \
    /prod/api/dist/features/auth/development-auth.module.js \
    /prod/api/dist/features/auth/development-auth.types.js \
  && test ! -e /prod/api/dist/dev-main.js \
  && test ! -e /prod/api/dist/features/auth/development-auth.controller.js \
  && test ! -e /prod/api/dist/features/auth/development-auth.module.js \
  && test ! -e /prod/api/dist/features/auth/development-auth.types.js

FROM node:22.14.0-alpine3.21 AS production

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app \
  && adduser -S -u 10001 -G app app

COPY --from=production-deps --chown=app:app /prod/api ./

USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
