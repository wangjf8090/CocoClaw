FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl

COPY packages/memory/package.json ./package.json
RUN npm install --only=production

COPY packages/memory/src/ ./src/

EXPOSE 8082

CMD ["node", "src/index.js"]
