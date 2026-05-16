# SelfClaw Gateway Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制package文件
COPY package.json .

# 安装依赖
RUN npm install || true

# 复制代码
COPY packages/gateway ./packages/gateway

# 设置环境
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# 启动命令
CMD ["node", "packages/gateway/src/index.js"]
