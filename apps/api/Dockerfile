FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY shared/contracts/package.json shared/contracts/package.json
COPY shared/config/package.json shared/config/package.json
COPY shared/config/tsconfig/base.json shared/config/tsconfig/base.json

RUN pnpm install --filter @soc/api... --no-frozen-lockfile

COPY apps/api apps/api
COPY shared/contracts shared/contracts
COPY shared/config shared/config

WORKDIR /app/apps/api

EXPOSE 3000
CMD ["pnpm", "dev"]
