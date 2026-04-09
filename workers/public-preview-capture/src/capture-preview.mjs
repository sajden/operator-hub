import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const args = {
    url: '',
    output: '',
    width: 1440,
    height: 900
  }

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--url') {
      args.url = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (value === '--output') {
      args.output = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (value === '--width') {
      args.width = Number(argv[index + 1] ?? args.width)
      index += 1
      continue
    }
    if (value === '--height') {
      args.height = Number(argv[index + 1] ?? args.height)
      index += 1
      continue
    }
  }

  if (!args.url || !args.output) {
    throw new Error('Usage: npm run capture -- --url <https-url> --output </abs/path.png> [--width 1440] [--height 900]')
  }

  return args
}

async function runProcess(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `Process exited with code ${code}`))
    })
  })
}

async function main() {
  const args = parseArgs(process.argv)
  await mkdir(path.dirname(args.output), { recursive: true })

  await runProcess(
    process.env.OPERATOR_HUB_SCREENSHOT_BROWSER ?? '/usr/bin/chromium',
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-sandbox',
      `--window-size=${args.width},${args.height}`,
      `--screenshot=${args.output}`,
      args.url
    ],
    process.cwd()
  )

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath: args.output,
        width: args.width,
        height: args.height,
        browser: process.env.OPERATOR_HUB_SCREENSHOT_BROWSER ?? '/usr/bin/chromium'
      },
      null,
      2
    )}\n`
  )
}

await main()
