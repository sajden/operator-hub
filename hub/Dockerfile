FROM node:22-alpine

WORKDIR /workspace/hub

COPY hub/package.json ./
COPY hub/ ./

EXPOSE 8787

CMD ["node", "server.mjs"]
