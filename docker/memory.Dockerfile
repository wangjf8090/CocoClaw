FROM node:20-alpine

WORKDIR /app

# 先复制 package.json 并安装依赖
COPY packages/memory/package.json ./package.json
RUN npm install --only=production

# 然后复制源代码
COPY packages/memory/src/ ./src/

EXPOSE 8082

CMD ["node", "src/index.js"]
