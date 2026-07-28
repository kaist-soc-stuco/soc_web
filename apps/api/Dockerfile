FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache bash

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY shared/common/package.json shared/common/package.json
COPY shared/contracts/package.json shared/contracts/package.json
COPY shared/config/package.json shared/config/package.json
COPY shared/config/tsconfig/base.json shared/config/tsconfig/base.json

COPY apps/api apps/api
COPY shared/common shared/common
COPY shared/contracts shared/contracts
COPY infra/scripts infra/scripts
COPY shared/config shared/config
RUN pnpm install --no-frozen-lockfile

WORKDIR /app/apps/api

EXPOSE 3000
CMD ["pnpm", "dev"]
