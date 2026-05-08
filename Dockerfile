# syntax=docker/dockerfile:1

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY server ./server
COPY src/data ./src/data
COPY src/types ./src/types
COPY src/utils/assessment ./src/utils/assessment
COPY tsconfig.json tsconfig.server.json ./

EXPOSE 3010

CMD ["pnpm", "api"]
