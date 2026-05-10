FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl

COPY packages/query-engine/package.json ./package.json
RUN npm install --only=production

COPY packages/query-engine/src/ ./src/

EXPOSE 8081

CMD ["node", "src/index.js"]
