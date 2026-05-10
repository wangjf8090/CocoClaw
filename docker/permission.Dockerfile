FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl

COPY packages/permission/package.json ./package.json
RUN npm install --only=production

COPY packages/permission/src/ ./src/

EXPOSE 8083

CMD ["node", "src/index.js"]
