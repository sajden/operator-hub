import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {
    output: '',
    hookText: 'STANNAR DU?',
    subText: 'SE DETTA TILL SLUTET',
    durationFrames: 75,
    fps: 30,
    width: 1080,
    height: 1920,
    accentColor: '#FFA500'
  }

  for (let i = 2; i < argv.length; i += 1) {
    const v = argv[i]
    if (v === '--output') { args.output = argv[i + 1] ?? ''; i += 1; continue }
    if (v === '--hook-text') { args.hookText = argv[i + 1] ?? args.hookText; i += 1; continue }
    if (v === '--sub-text') { args.subText = argv[i + 1] ?? args.subText; i += 1; continue }
    if (v === '--duration-frames') { args.durationFrames = Number(argv[i + 1] ?? args.durationFrames); i += 1; continue }
    if (v === '--accent-color') { args.accentColor = argv[i + 1] ?? args.accentColor; i += 1; continue }
  }

  if (!args.output) throw new Error('Usage: node render-intro-card.mjs --output /abs/out.mp4 [--hook-text "TEXT"]')
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

async function main() {
  const args = parseArgs(process.argv)
  const outputPath = path.resolve(args.output)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const tempPropsPath = `${outputPath}.props.json`
  const cliPath = path.resolve(workerRoot, 'node_modules/@remotion/cli/remotion-cli.js')
  const browserExecutable = process.env.OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE || '/usr/bin/chromium'

  const props = {
    introCard: {
      hookText: args.hookText,
      subText: args.subText,
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
      'ShortFormIntroCard',
      outputPath,
      `--props=${tempPropsPath}`,
      `--browser-executable=${browserExecutable}`,
      '--concurrency=2'
    ], workerRoot)
  } finally {
    await import('node:fs/promises').then(({ unlink }) => unlink(tempPropsPath).catch(() => {}))
  }

  process.stdout.write(`${JSON.stringify({ ok: true, outputPath }, null, 2)}\n`)
}

await main()
