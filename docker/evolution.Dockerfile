FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl

COPY packages/evolution/package.json ./package.json
RUN npm install --only=production

COPY packages/evolution/src/ ./src/

EXPOSE 8084

CMD ["node", "src/index.js"]
