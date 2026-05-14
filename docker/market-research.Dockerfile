FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
COPY packages/market-research/package.json ./packages/market-research/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

# 复制代码
COPY packages/market-research/ ./packages/market-research/
COPY packages/shared/ ./packages/shared/

# 复制启动脚本
COPY scripts/start-market-research.sh ./scripts/
RUN chmod +x ./scripts/start-market-research.sh

CMD ["./scripts/start-market-research.sh"]
