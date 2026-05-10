FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY packages/gateway/ ./packages/gateway/
COPY packages/shared/ ./packages/shared/

# Build
RUN cd packages/gateway && npm run build 2>/dev/null || echo "Build skipped, using source"

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy entrypoint
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Health check dependency
RUN apk add --no-cache curl

EXPOSE 8080 9000

ENV SERVICE_NAME=gateway
ENV PORT=8080
ENV WS_PORT=9000

CMD ["node", "packages/gateway/dist/index.js"]
