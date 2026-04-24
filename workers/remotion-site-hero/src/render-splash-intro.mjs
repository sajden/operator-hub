import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {
    output: '',
    speakerFrame: '',
    articleImage: '',
    captionsJson: '',
    headlineText: 'SENASTE NYTT',
    durationFrames: 90,
    fps: 30,
    width: 1080,
    height: 1920,
    accentColor: '#FFA500'
  }

  for (let i = 2; i < argv.length; i += 1) {
    const v = argv[i]
    if (v === '--output') { args.output = argv[i + 1] ?? ''; i += 1; continue }
    if (v === '--speaker-frame' || v === '--speaker-video') { args.speakerFrame = argv[i + 1] ?? ''; i += 1; continue }
    if (v === '--article-image') { args.articleImage = argv[i + 1] ?? ''; i += 1; continue }
    if (v === '--captions-json') { args.captionsJson = argv[i + 1] ?? ''; i += 1; continue }
    if (v === '--headline-text') { args.headlineText = argv[i + 1] ?? args.headlineText; i += 1; continue }
    if (v === '--duration-frames') { args.durationFrames = Number(argv[i + 1] ?? args.durationFrames); i += 1; continue }
    if (v === '--accent-color') { args.accentColor = argv[i + 1] ?? args.accentColor; i += 1; continue }
  }

  if (!args.output) throw new Error('Usage: node render-splash-intro.mjs --output /abs/out.mp4 --speaker-video /abs/video.mp4 --article-image /abs/article.png --headline-text "TEXT"')
  return args
}

async function runProcess(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) { resolve(); return }
      reject(new Error(`Process exited with code ${code}`))
    })
  })
}

// Serves a single file over HTTP so Remotion's compositor can fetch it.
// Returns { url, close }.
function serveFileHttp(absolutePath) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let fileSize
      try { fileSize = statSync(absolutePath).size } catch (_) { res.writeHead(404); res.end(); return }
      const ext = path.extname(absolutePath).toLowerCase()
      const mime = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': fileSize, 'Accept-Ranges': 'bytes' })
      createReadStream(absolutePath).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ url: `http://127.0.0.1:${port}/video`, close: () => server.close() })
    })
    server.on('error', reject)
  })
}

async function toDataUri(filePath) {
  if (!filePath) return null
  try {
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    const data = await readFile(path.resolve(filePath))
    return `data:${mime};base64,${data.toString('base64')}`
  } catch (_) {
    return null
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const outputPath = path.resolve(args.output)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const tempPropsPath = `${outputPath}.props.json`
  const cliPath = path.resolve(workerRoot, 'node_modules/@remotion/cli/remotion-cli.js')
  const browserExecutable = process.env.OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE || '/usr/bin/chromium'

  // Serve video over HTTP (compositor only supports http/https); article image uses base64 (Img blocks file://)
  let speakerServer = null
  let speakerSrc = null
  if (args.speakerFrame) {
    speakerServer = await serveFileHttp(path.resolve(args.speakerFrame))
    speakerSrc = speakerServer.url
  }
  const articleDataUri = await toDataUri(args.articleImage)

  let captions = []
  if (args.captionsJson) {
    try { captions = JSON.parse(await readFile(path.resolve(args.captionsJson), 'utf-8')) } catch (_) {}
  }

  const props = {
    splashIntro: {
      speakerSrc,
      articleSrc: articleDataUri,
      captions,
      headlineText: args.headlineText,
      accentColor: args.accentColor,
      fps: args.fps,
      width: args.width,
      height: args.height,
      durationInFrames: args.durationFrames
    }
  }

  await writeFile(tempPropsPath, JSON.stringify(props, null, 2), 'utf-8')

  try {
    await runProcess('node', [
      cliPath,
      'render',
      path.resolve(workerRoot, 'src/index.mjs'),
      'ShortFormSplashIntro',
      outputPath,
      `--props=${tempPropsPath}`,
      `--browser-executable=${browserExecutable}`,
      '--concurrency=2'
    ], workerRoot)
  } finally {
    if (speakerServer) speakerServer.close()
    await import('node:fs/promises').then(({ unlink }) => unlink(tempPropsPath).catch(() => {}))
  }

  process.stdout.write(`${JSON.stringify({ ok: true, outputPath }, null, 2)}\n`)
}

await main()
