FROM node:22-bookworm-slim

ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN apt-get update   && apt-get install -y --no-install-recommends     ffmpeg     python3     python3-pip     chromium     fonts-dejavu-core     ca-certificates   && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir openai-whisper

WORKDIR /app

# Remotion render workers (need their own node_modules)
COPY workers/remotion-site-hero/package.json workers/remotion-site-hero/package-lock.json* ./workers/remotion-site-hero/
RUN cd workers/remotion-site-hero && npm install --legacy-peer-deps

COPY workers/remotion-site-hero/src/ ./workers/remotion-site-hero/src/

# Pipeline service
COPY video-pipeline/package.json .
RUN npm install --omit=dev
COPY video-pipeline/src/server.mjs ./src/

# Pipeline source files from hub
COPY hub/shortFormVideoTools.mjs \
     hub/shortFormCloudWatcher.mjs \
     hub/shortFormWatcher.mjs \
     hub/shortFormCloudUpload.mjs \
     hub/bgRemoverCloudWatcher.mjs \
     hub/bgRemoverTools.mjs \
     hub/microsoftAuth.mjs \
     ./src/

COPY hub/agents/ ./src/agents/

ENV NODE_ENV=production
ENV OPERATOR_HUB_REPO_ROOT=/app

EXPOSE 3420
CMD ["node", "src/server.mjs"]
