# Build from the repository root:  docker build -f apps/realtime/Dockerfile -t myminijob-realtime .
FROM node:22-bookworm-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @myminijob/realtime... && pnpm --filter @myminijob/db generate
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "@myminijob/realtime", "start"]
