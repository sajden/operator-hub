import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function parseArgs(argv) {
  const args = { job: '', dryRun: false }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--job') {
      args.job = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (value === '--dry-run') {
      args.dryRun = true
    }
  }
  if (!args.job) throw new Error('Usage: npm run render:job -- --job /abs/path/to/job.json [--dry-run]')
  return args
}

function nowIso() {
  return new Date().toISOString()
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf-8'))
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

function ensureFileExists(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`Missing ${label}: ${filePath}`)
}

function guessMimeType(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

function detectBrowserExecutable() {
  const configured = process.env.OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE?.trim()
  if (configured && existsSync(configured)) return configured
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge'
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function runProcess(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Process exited with code ${code}`))
    })
  })
}

function collectReferencedAssets(composition) {
  const referenced = new Set()
  for (const group of Object.values(composition.assets ?? {})) {
    if (!Array.isArray(group)) continue
    for (const asset of group) {
      if (asset?.localPath) referenced.add(String(asset.localPath))
    }
  }
  for (const scene of composition.scenes ?? []) {
    if (scene?.primaryAsset) referenced.add(String(scene.primaryAsset))
    if (Array.isArray(scene?.supportingAssets)) {
      for (const asset of scene.supportingAssets) {
        if (asset) referenced.add(String(asset))
      }
    }
  }
  return [...referenced]
}

async function startAssetServer(repoRoot, assetPaths) {
  const allowed = new Map(assetPaths.map((assetPath) => [assetPath, path.resolve(repoRoot, assetPath)]))
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
    const relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/asset\//, ''))
    const absolutePath = allowed.get(relativePath)
    if (!absolutePath || !existsSync(absolutePath)) {
      res.statusCode = 404
      res.end('Missing asset')
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', guessMimeType(relativePath))
    createReadStream(absolutePath).pipe(res)
  })
  const port = await new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Unable to determine asset server address'))
      resolve(address.port)
    })
  })
  return {
    assetUrlMap: Object.fromEntries(assetPaths.map((assetPath) => [assetPath, `http://127.0.0.1:${port}/asset/${assetPath}`])),
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

function plannedStillFrames(durationInFrames) {
  const lastFrame = Math.max(0, durationInFrames - 1)
  const fractions = [0.18, 0.5, 0.82]
  return fractions.map((fraction, index) => ({
    index: index + 1,
    frame: Math.max(0, Math.min(lastFrame, Math.round(lastFrame * fraction)))
  }))
}

async function renderStillFrames({ cliPath, workerRoot, browserExecutable, inputPropsPath, plannedOutputPath, durationInFrames }) {
  const outputDir = path.dirname(plannedOutputPath)
  const baseName = path.basename(plannedOutputPath, path.extname(plannedOutputPath))
  const frames = plannedStillFrames(durationInFrames)
  const outputs = []

  for (const item of frames) {
    const stillPath = path.resolve(outputDir, `${baseName}-frame-${String(item.index).padStart(2, '0')}.png`)
    await runProcess(
      'node',
      [
        cliPath,
        'still',
        'src/index.mjs',
        'ServiceExplainerMotion',
        stillPath,
        `--props=${inputPropsPath}`,
        `--browser-executable=${browserExecutable}`,
        `--frame=${item.frame}`
      ],
      workerRoot
    )
    outputs.push({ frame: item.frame, path: stillPath })
  }

  return outputs
}

async function main() {
  const args = parseArgs(process.argv)
  const jobPath = path.resolve(args.job)
  ensureFileExists(jobPath, 'job file')
  const job = await readJson(jobPath)
  const compositionPath = path.resolve(path.dirname(jobPath), path.basename(job.compositionPath))
  ensureFileExists(compositionPath, 'composition file')
  const composition = await readJson(compositionPath)
  const repoRoot = path.resolve(path.dirname(jobPath), '../../../..')
  const assetPaths = collectReferencedAssets(composition)
  const missingAssets = assetPaths.filter((assetPath) => !existsSync(path.resolve(repoRoot, assetPath)))

  const outputDir = path.resolve(path.dirname(jobPath), 'outputs')
  await mkdir(outputDir, { recursive: true })
  const inputPropsPath = path.resolve(outputDir, `${job.jobId}.input-props.json`)

  const executionPlan = {
    worker: 'remotion-service-explainer',
    jobId: job.jobId,
    title: composition.title,
    status: args.dryRun ? 'validated' : 'planned',
    validatedAt: nowIso(),
    dryRun: args.dryRun,
    compositionPath,
    plannedOutputPath: path.resolve(repoRoot, job.plannedOutputPath),
    previewFrames: [],
    diagnostics: {
      assetCount: assetPaths.length,
      missingAssets
    }
  }

  const planPath = path.resolve(outputDir, `${job.jobId}.execution-plan.json`)
  let assetServer = null
  const inputProps = {
    composition,
    repoRoot,
    assetUrlMap: {}
  }

  if (missingAssets.length === 0) {
    assetServer = await startAssetServer(repoRoot, assetPaths)
    inputProps.assetUrlMap = assetServer.assetUrlMap
  }

  await writeJson(inputPropsPath, inputProps)
  await writeJson(planPath, executionPlan)

  try {
    if (!args.dryRun && missingAssets.length === 0) {
      const browserExecutable = detectBrowserExecutable()
      if (!browserExecutable) {
        throw new Error('No browser executable found for Remotion render. Set OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE or install Chromium/Chrome.')
      }
      const workerRoot = path.resolve(__dirname, '..')
      const cliPath = path.resolve(workerRoot, 'node_modules/@remotion/cli/remotion-cli.js')
      const plannedOutputPath = path.resolve(repoRoot, job.plannedOutputPath)

      await runProcess(
        'node',
        [
          cliPath,
          'render',
          'src/index.mjs',
          'ServiceExplainerMotion',
          plannedOutputPath,
          `--props=${inputPropsPath}`,
          `--browser-executable=${browserExecutable}`,
          '--concurrency=2'
        ],
        workerRoot
      )

      executionPlan.previewFrames = await renderStillFrames({
        cliPath,
        workerRoot,
        browserExecutable,
        inputPropsPath,
        plannedOutputPath,
        durationInFrames: composition.durationInFrames
      })
      executionPlan.status = 'rendered'
      executionPlan.renderedAt = nowIso()
      await writeJson(planPath, executionPlan)
    }
  } finally {
    if (assetServer) await assetServer.close()
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
