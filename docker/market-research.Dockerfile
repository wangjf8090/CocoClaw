FROM node:20-alpine

WORKDIR /app

# 先复制 package.json 安装依赖
COPY packages/market-research/package.json ./
RUN npm install

# 然后复制代码
COPY packages/market-research/ ./

# 复制启动脚本
COPY scripts/start-market-research.sh /app/scripts/
RUN chmod +x /app/scripts/start-market-research.sh

CMD ["./scripts/start-market-research.sh"]
