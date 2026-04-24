import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {
    output: '',
    handle: '@sebcastwall',
    followText: 'FÖLJ MIG',
    durationFrames: 90,
    fps: 30,
    width: 1080,
    height: 1920,
    bgColor: '#0d0d0d',
    accentColor: '#FFA500'
  }

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--output') { args.output = argv[index + 1] ?? ''; index += 1; continue }
    if (value === '--handle') { args.handle = argv[index + 1] ?? args.handle; index += 1; continue }
    if (value === '--follow-text') { args.followText = argv[index + 1] ?? args.followText; index += 1; continue }
    if (value === '--duration-frames') { args.durationFrames = Number(argv[index + 1] ?? args.durationFrames); index += 1; continue }
    if (value === '--bg-color') { args.bgColor = argv[index + 1] ?? args.bgColor; index += 1; continue }
    if (value === '--accent-color') { args.accentColor = argv[index + 1] ?? args.accentColor; index += 1; continue }
  }

  if (!args.output) throw new Error('Usage: node render-outro.mjs --output /abs/out.mp4 [--handle @sebcastwall]')
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
    outro: {
      handle: args.handle,
      followText: args.followText,
      bgColor: args.bgColor,
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
      'ShortFormOutro',
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
