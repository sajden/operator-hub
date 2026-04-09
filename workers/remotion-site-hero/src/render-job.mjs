import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function parseArgs(argv) {
  const args = {
    job: '',
    dryRun: false
  }

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

  if (!args.job) {
    throw new Error('Usage: npm run render:job -- --job /abs/path/to/job.json [--dry-run]')
  }

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

function guessMimeType(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
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
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Process exited with code ${code}`))
    })
  })
}

function ensureFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`)
  }
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
  const allowed = new Map(
    assetPaths.map((assetPath) => {
      const absolutePath = path.resolve(repoRoot, assetPath)
      return [assetPath, absolutePath]
    })
  )

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
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine asset server address'))
        return
      }
      resolve(address.port)
    })
  })

  return {
    assetUrlMap: Object.fromEntries(
      assetPaths.map((assetPath) => [assetPath, `http://127.0.0.1:${port}/asset/${assetPath}`])
    ),
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
    worker: 'remotion-site-hero',
    jobId: job.jobId,
    title: composition.title,
    status: args.dryRun ? 'validated' : 'planned',
    validatedAt: nowIso(),
    dryRun: args.dryRun,
    compositionPath,
    plannedOutputPath: path.resolve(repoRoot, job.plannedOutputPath),
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

  let renderResultPath = null
  try {
    if (!args.dryRun && missingAssets.length === 0) {
    const browserExecutable = detectBrowserExecutable()
    if (!browserExecutable) {
      throw new Error(
        'No browser executable found for Remotion render. Set OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE or install Chromium/Chrome.'
      )
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
          'SiteHeroMotion',
          plannedOutputPath,
          `--props=${inputPropsPath}`,
          `--browser-executable=${browserExecutable}`,
          '--concurrency=2'
        ],
        workerRoot
      )

      renderResultPath = plannedOutputPath
      executionPlan.status = 'rendered'
      executionPlan.renderedAt = nowIso()
      await writeJson(planPath, executionPlan)
    }
  } finally {
    if (assetServer) {
      await assetServer.close()
    }
  }

  const result = {
    ok: missingAssets.length === 0,
    worker: 'remotion-site-hero',
    jobId: job.jobId,
    compositionPath,
    executionPlanPath: planPath,
    inputPropsPath,
    plannedOutputPath: executionPlan.plannedOutputPath,
    outputPath: renderResultPath,
    missingAssets
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

  if (missingAssets.length > 0) {
    process.exitCode = 1
  }
}

await main()
