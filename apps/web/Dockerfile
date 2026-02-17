FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --filter @soc/web... --no-frozen-lockfile

COPY apps/web apps/web
COPY packages/api-client packages/api-client
COPY packages/contracts packages/contracts
COPY packages/shared packages/shared
COPY packages/config packages/config

WORKDIR /app/apps/web

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
