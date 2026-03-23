FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY shared/api-client/package.json shared/api-client/package.json
COPY shared/contracts/package.json shared/contracts/package.json
COPY shared/common/package.json shared/common/package.json
COPY shared/config/package.json shared/config/package.json

RUN pnpm install --filter @soc/web... --no-frozen-lockfile

COPY apps/web apps/web
COPY shared/api-client shared/api-client
COPY shared/contracts shared/contracts
COPY shared/common shared/common
COPY shared/config shared/config

WORKDIR /app/apps/web

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
