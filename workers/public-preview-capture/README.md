# Public Preview Capture Worker

Standalone bounded screenshot worker for `capture_public_profile_preview`.

## Build

```bash
cd /home/sajden/github/operator-hub/workers/public-preview-capture
docker build -t operator-hub-public-preview-capture .
```

## Run

```bash
docker run --rm \
  -v /home/sajden/github/operator-hub:/workspace/operator-hub \
  -w /workspace \
  operator-hub-public-preview-capture \
  npm run capture -- \
    --url https://example.com \
    --output /workspace/operator-hub/.local/assets/public-previews/test/example.png
```
