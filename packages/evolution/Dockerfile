# SelfClaw Evolution Service v2.0
# Skill Audit + Optimize + Lifecycle

FROM node:20-alpine

WORKDIR /app

# Install ALL dependencies (including typescript for build)
COPY package.json ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN rm -rf src/ tsconfig.json node_modules/.cache
RUN npm prune --omit=dev

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8084/health || exit 1

CMD ["node", "dist/index.js"]
