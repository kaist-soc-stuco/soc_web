FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/config/tsconfig/base.json packages/config/tsconfig/base.json

RUN pnpm install --filter @soc/api... --no-frozen-lockfile

COPY apps/api apps/api
COPY packages/config packages/config

WORKDIR /app/apps/api

EXPOSE 3000
CMD ["pnpm", "dev"]
