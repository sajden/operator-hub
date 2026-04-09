FROM node:20-alpine

WORKDIR /workspace/hub

COPY hub/package.json ./
COPY hub/server.mjs ./
COPY hub/graphProjection.mjs ./
COPY hub/mcpTools.mjs ./
COPY hub/researchTools.mjs ./
COPY hub/microsoftAuth.mjs ./
COPY hub/skills.mjs ./

EXPOSE 8787

CMD ["node", "server.mjs"]
