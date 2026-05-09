FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 8080 8443 9000

CMD ["node", "src/gateway/index.js"]
