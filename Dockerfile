# TruthLayer monorepo Dockerfile
#
# References (research first):
# - Node Corepack: https://nodejs.org/api/corepack.html
# - pnpm via Corepack: https://pnpm.io/installation#using-corepack
# - Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage/
# - Next.js Docker guidance: https://nextjs.org/docs/app/building-your-application/deploying#docker-image
# - Puppeteer Linux deps: https://pptr.dev/troubleshooting#chrome-does-not-launch-on-linux

# Base with Debian (for Puppeteer/Chromium compatibility). Node >= 18.18 required; use Node 20.
FROM node:20-bookworm-slim AS base

ENV NODE_ENV=production \
    CI=true \
    PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Common OS deps (ca-certificates, git) and fonts/libs often needed by headless Chromium
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    wget \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack and pin to repo version (from root package.json)
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /workspace

# 1) Copy only manifests first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Workspace package manifests
COPY packages/config/package.json packages/config/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY apps/annotation/package.json apps/annotation/package.json
COPY apps/collector/package.json apps/collector/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/metrics/package.json apps/metrics/package.json
COPY apps/scheduler/package.json apps/scheduler/package.json
COPY apps/storage/package.json apps/storage/package.json

# Pre-fetch deps to leverage pnpm store caching
RUN pnpm fetch --loglevel warn

# 2) Now copy the full repo
COPY . .

# Install exact versions from lockfile across workspace
RUN pnpm install --frozen-lockfile --loglevel warn

# Build all packages/apps
RUN pnpm -r build

# Final runtime image keeps node_modules and built artifacts so others can reuse "environment packages"
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Keep a small set of runtime libs for Puppeteer/Chromium if users run the collector inside
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm in runtime too for optional workspace scripts
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /workspace

# Copy built workspace, node_modules, and sources
COPY --from=base /workspace /workspace

# Default command shows help; users can override to run specific apps
CMD ["node", "-e", "console.log('TruthLayer image ready. Examples:'); console.log('- Dashboard dev: pnpm --filter @truthlayer/dashboard dev'); console.log('- Collector run: node apps/collector/dist/index.js'); console.log('- Scheduler run: node apps/scheduler/dist/index.js');"]
