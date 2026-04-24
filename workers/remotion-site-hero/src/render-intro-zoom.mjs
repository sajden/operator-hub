import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    durationFrames: 18,
    fps: 30,
    width: 1080,
    height: 1920,
    zoomFrames: 16,
    startScale: 1.045,
    endScale: 1
  }

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--input') {
      args.input = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (value === '--output') {
      args.output = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (value === '--duration-frames') {
      args.durationFrames = Number(argv[index + 1] ?? args.durationFrames)
      index += 1
      continue
    }
  }

  if (!args.input || !args.output) {
    throw new Error('Usage: node src/render-intro-zoom.mjs --input /abs/in.mp4 --output /abs/out.mp4 [--duration-frames 18]')
  }

  return args
}

function guessMimeType(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.mov')) return 'video/quicktime'
  return 'application/octet-stream'
}

async function runProcess(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Process exited with code ${code}`))
    })
  })
}

async function startSingleFileServer(filePath) {
  const normalizedPath = path.resolve(filePath)
  const fileName = path.basename(normalizedPath)
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (decodeURIComponent(requestUrl.pathname) !== `/${fileName}` || !existsSync(normalizedPath)) {
      res.statusCode = 404
      res.end('Missing asset')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', guessMimeType(normalizedPath))
    createReadStream(normalizedPath).pipe(res)
  })

  const port = await new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine asset server address'))
        return
      }
      resolve(address.port)
    })
  })

  return {
    url: `http://127.0.0.1:${port}/${encodeURIComponent(fileName)}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const inputPath = path.resolve(args.input)
  const outputPath = path.resolve(args.output)
  if (!existsSync(inputPath)) {
    throw new Error(`Missing input file: ${inputPath}`)
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  const tempPropsPath = path.resolve(path.dirname(outputPath), `${path.basename(outputPath)}.props.json`)
  const cliPath = path.resolve(workerRoot, 'node_modules/@remotion/cli/remotion-cli.js')
  const browserExecutable = process.env.OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE || '/usr/bin/chromium'

  const assetServer = await startSingleFileServer(inputPath)
  try {
    const props = {
      introZoom: {
        title: 'Short-form intro zoom',
        fps: args.fps,
        width: args.width,
        height: args.height,
        durationInFrames: args.durationFrames,
        videoSrc: assetServer.url,
        zoomFrames: args.zoomFrames,
        startScale: args.startScale,
        endScale: args.endScale
      }
    }
    await writeFile(tempPropsPath, JSON.stringify(props, null, 2), 'utf-8')

    await runProcess(
      'node',
      [
        cliPath,
        'render',
        path.resolve(workerRoot, 'src/index.mjs'),
        'ShortFormIntroZoom',
        outputPath,
        `--props=${tempPropsPath}`,
        `--browser-executable=${browserExecutable}`,
        '--concurrency=2'
      ],
      workerRoot
    )
  } finally {
    await assetServer.close()
  }

  process.stdout.write(`${JSON.stringify({ ok: true, outputPath }, null, 2)}\n`)
}

await main()
