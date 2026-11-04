# One-off job image: applies migrations (and optionally seeds reference data).
#   docker build -f packages/db/Dockerfile -t myminijob-migrate .
#   docker run --rm -e DATABASE_URL=... myminijob-migrate
FROM node:22-bookworm-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @myminijob/db...
CMD ["sh", "-c", "pnpm --filter @myminijob/db migrate && pnpm --filter @myminijob/db seed"]
