# SelfClaw Evolution Service v2.0
# Skill Audit + Optimize + Lifecycle

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Cleanup dev dependencies
RUN rm -rf src/ tsconfig.json node_modules/.cache

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8084/health || exit 1

CMD ["node", "dist/index.js"]
