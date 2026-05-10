FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl

COPY packages/soul/package.json ./package.json
RUN npm install --only=production

COPY packages/soul/src/ ./src/

EXPOSE 8085

CMD ["node", "src/index.js"]
