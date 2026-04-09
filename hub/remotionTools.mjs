import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const hostRepoRoot = process.env.OPERATOR_HUB_HOST_REPO_ROOT?.trim()
  ? path.resolve(process.env.OPERATOR_HUB_HOST_REPO_ROOT.trim())
  : repoRoot
const ownerMediaRoot = path.resolve(repoRoot, '.local/assets/owner-media')
const stockMediaRoot = path.resolve(repoRoot, '.local/assets/stock-media')
const previewMediaRoot = path.resolve(repoRoot, '.local/assets/public-previews')
const motionRoot = path.resolve(repoRoot, '.local/renders/site-hero-motion')
const serviceExplainerRoot = process.env.OPERATOR_HUB_SERVICE_EXPLAINER_RENDER_ROOT?.trim()
  ? path.resolve(process.env.OPERATOR_HUB_SERVICE_EXPLAINER_RENDER_ROOT.trim())
  : path.resolve(repoRoot, '.local/renders/service-explainer-motion')
const remotionDockerImage = process.env.OPERATOR_HUB_REMOTION_DOCKER_IMAGE ?? 'operator-hub-remotion-site-hero'
const serviceExplainerDockerImage =
  process.env.OPERATOR_HUB_REMOTION_SERVICE_EXPLAINER_DOCKER_IMAGE ?? 'operator-hub-remotion-service-explainer'
const ALLOWED_TEMPLATES = new Set(['founder_intro', 'startup_signal', 'product_story', 'case_strip'])
const ALLOWED_FOCUS = new Set(['founder', 'product', 'brand', 'mixed'])
const ALLOWED_TONES = new Set(['clean_premium', 'operator_tech', 'bold_editorial', 'calm_trust'])
const ALLOWED_PACE = new Set(['slow', 'medium', 'fast'])
const ALLOWED_ASPECT_RATIOS = new Set(['square', 'portrait', 'landscape'])
const ALLOWED_SCENE_TYPES = new Set([
  'full_bleed_photo',
  'split_product',
  'headline_overlay',
  'proof_grid',
  'founder_closeup',
  'device_focus',
  'ambient_logo_strip'
])
const ALLOWED_SERVICE_EXPLAINER_MODES = new Set(['three_step_process', 'before_after', 'service_spotlight'])
const ALLOWED_SERVICE_TYPES = new Set(['automation', 'integration', 'internal_tools', 'generic'])
const ALLOWED_EXPLAINER_SCENE_TYPES = new Set([
  'problem_flow',
  'decision_router',
  'outcome_dashboard',
  'before_after_split',
  'service_path_strip'
])
const ALLOWED_EXPLAINER_STATE = new Set(['broken', 'mixed', 'calm'])
const ALLOWED_ALIGN = new Set(['left', 'center', 'right'])
const ALLOWED_OVERLAY_STYLES = new Set(['dark_gradient', 'light_fade', 'soft_panel', 'none'])
const ALLOWED_MOTION_STYLES = new Set(['slow_push', 'steady', 'drift_left', 'drift_right'])

function nowIso() {
  return new Date().toISOString()
}

function sha(input) {
  return createHash('sha256').update(input).digest('hex')
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function relativeLocalPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/')
}

async function readJsonFileIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

function normalizeRenderInput(input) {
  const projectSlug = slugify(input?.projectSlug)
  if (!projectSlug) {
    throw new Error('render_site_hero_motion requires projectSlug')
  }

  const title = String(input?.title ?? 'Site hero motion').trim() || 'Site hero motion'
  const fps = Math.max(24, Math.min(Number(input?.fps ?? 30), 60))
  const aspectRatio = ALLOWED_ASPECT_RATIOS.has(String(input?.aspectRatio ?? '').trim())
    ? String(input.aspectRatio).trim()
    : 'square'
  const ratioDimensions =
    aspectRatio === 'portrait'
      ? { width: 1080, height: 1350 }
      : aspectRatio === 'landscape'
        ? { width: 1600, height: 900 }
        : { width: 1080, height: 1080 }
  const width = Math.max(720, Math.min(Number(input?.width ?? ratioDimensions.width), 3840))
  const height = Math.max(720, Math.min(Number(input?.height ?? ratioDimensions.height), 3840))
  const style = slugify(input?.style ?? 'clean-operator') || 'clean-operator'
  const template = ALLOWED_TEMPLATES.has(String(input?.template ?? '').trim())
    ? String(input.template).trim()
    : 'startup_signal'
  const focus = ALLOWED_FOCUS.has(String(input?.focus ?? '').trim())
    ? String(input.focus).trim()
    : 'mixed'
  const tone = ALLOWED_TONES.has(String(input?.tone ?? '').trim())
    ? String(input.tone).trim()
    : 'operator_tech'
  const pace = ALLOWED_PACE.has(String(input?.pace ?? '').trim())
    ? String(input.pace).trim()
    : 'medium'
  const cta = String(input?.cta ?? '').trim()
  const contentArea = slugify(input?.contentArea ?? '')
  const durationDefault =
    template === 'case_strip' ? 6 : template === 'founder_intro' ? 5 : template === 'product_story' ? 7 : 6
  const durationInSeconds = Math.max(3, Math.min(Number(input?.durationInSeconds ?? durationDefault), 20))

  const ownerAssetPaths = Array.isArray(input?.ownerAssetPaths)
    ? input.ownerAssetPaths.map((value) => String(value).trim()).filter(Boolean)
    : []
  const stockAssetPaths = Array.isArray(input?.stockAssetPaths)
    ? input.stockAssetPaths.map((value) => String(value).trim()).filter(Boolean)
    : []
  const previewAssetPaths = Array.isArray(input?.previewAssetPaths)
    ? input.previewAssetPaths.map((value) => String(value).trim()).filter(Boolean)
    : []

  return {
    projectSlug,
    title,
    durationInSeconds,
    fps,
    width,
    height,
    style,
    template,
    focus,
    tone,
    pace,
    cta,
    contentArea,
    aspectRatio,
    ownerAssetPaths,
    stockAssetPaths,
    previewAssetPaths,
    scenes: Array.isArray(input?.scenes) ? input.scenes : []
  }
}

function resolveExistingAssetPath(rootDir, relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath)
  const normalizedRoot = path.resolve(rootDir)
  const relative = path.relative(normalizedRoot, absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(absolutePath)) {
    throw new Error(`Missing or invalid asset path: ${relativePath}`)
  }

  return absolutePath
}

async function loadManifestAssets(rootDir, projectSlug) {
  const manifestPath = path.resolve(rootDir, projectSlug, 'manifest.json')
  const manifest = await readJsonFileIfExists(manifestPath, { assets: [] })
  return Array.isArray(manifest.assets) ? manifest.assets : []
}

function filterAssetsForContentArea(assets, contentArea) {
  if (!contentArea) return assets
  const marker = `/${contentArea}/`
  return assets.filter((asset) => String(asset?.localPath ?? '').includes(marker))
}

function rankAssetsForFocus(assets, focus) {
  if (focus === 'founder') {
    return [...assets].sort((left, right) => {
      const leftScore = /profile|headshot|founder|portrait|seb/i.test(String(left?.localPath ?? '')) ? 1 : 0
      const rightScore = /profile|headshot|founder|portrait|seb/i.test(String(right?.localPath ?? '')) ? 1 : 0
      return rightScore - leftScore
    })
  }

  if (focus === 'product') {
    return [...assets].sort((left, right) => {
      const leftScore = /product|screen|dashboard|app|hero/i.test(String(left?.localPath ?? '')) ? 1 : 0
      const rightScore = /product|screen|dashboard|app|hero/i.test(String(right?.localPath ?? '')) ? 1 : 0
      return rightScore - leftScore
    })
  }

  return assets
}

function supportCountForPace(pace) {
  if (pace === 'slow') return 1
  if (pace === 'fast') return 3
  return 2
}

function buildMotionMeta(input) {
  return {
    template: input.template,
    focus: input.focus,
    tone: input.tone,
    pace: input.pace,
    cta: input.cta,
    contentArea: input.contentArea || null,
    aspectRatio: input.aspectRatio
  }
}

function buildServiceExplainerMeta(input) {
  return {
    mode: input.mode,
    serviceType: input.serviceType,
    tone: input.tone,
    pace: input.pace,
    aspectRatio: input.aspectRatio
  }
}

function normalizeServiceExplainerInput(input) {
  const projectSlug = slugify(input?.projectSlug)
  if (!projectSlug) {
    throw new Error('render_service_explainer_motion requires projectSlug')
  }

  const title = String(input?.title ?? 'Service explainer motion').trim() || 'Service explainer motion'
  const fps = Math.max(24, Math.min(Number(input?.fps ?? 30), 60))
  const aspectRatio = ALLOWED_ASPECT_RATIOS.has(String(input?.aspectRatio ?? '').trim())
    ? String(input.aspectRatio).trim()
    : 'landscape'
  const ratioDimensions =
    aspectRatio === 'portrait'
      ? { width: 1080, height: 1350 }
      : aspectRatio === 'square'
        ? { width: 1080, height: 1080 }
        : { width: 1600, height: 900 }
  const width = Math.max(720, Math.min(Number(input?.width ?? ratioDimensions.width), 3840))
  const height = Math.max(720, Math.min(Number(input?.height ?? ratioDimensions.height), 3840))
  const mode = ALLOWED_SERVICE_EXPLAINER_MODES.has(String(input?.mode ?? '').trim())
    ? String(input.mode).trim()
    : 'three_step_process'
  const serviceType = ALLOWED_SERVICE_TYPES.has(String(input?.serviceType ?? '').trim())
    ? String(input.serviceType).trim()
    : 'generic'
  const tone = ALLOWED_TONES.has(String(input?.tone ?? '').trim())
    ? String(input.tone).trim()
    : 'clean_premium'
  const pace = ALLOWED_PACE.has(String(input?.pace ?? '').trim())
    ? String(input.pace).trim()
    : 'medium'
  const durationInSeconds = Math.max(6, Math.min(Number(input?.durationInSeconds ?? 10), 20))
  const paletteInput = input?.palette && typeof input.palette === 'object' ? input.palette : {}
  const palette = {
    bgDark: String(paletteInput.bgDark ?? '#111821').trim() || '#111821',
    bgLight: String(paletteInput.bgLight ?? '#f6f2ea').trim() || '#f6f2ea',
    accent: String(paletteInput.accent ?? '#e9c58d').trim() || '#e9c58d',
    accentCool: String(paletteInput.accentCool ?? '#7aa2ff').trim() || '#7aa2ff'
  }
  const briefInput = input?.brief && typeof input.brief === 'object' ? input.brief : {}
  const brief = {
    problem: String(briefInput.problem ?? '').trim(),
    decision: String(briefInput.decision ?? '').trim(),
    outcome: String(briefInput.outcome ?? '').trim()
  }
  const ownerAssetPaths = Array.isArray(input?.ownerAssetPaths)
    ? input.ownerAssetPaths.map((value) => String(value).trim()).filter(Boolean)
    : []
  const stockAssetPaths = Array.isArray(input?.stockAssetPaths)
    ? input.stockAssetPaths.map((value) => String(value).trim()).filter(Boolean)
    : []
  const contentArea = slugify(input?.contentArea ?? '')

  return {
    projectSlug,
    title,
    mode,
    serviceType,
    tone,
    pace,
    aspectRatio,
    durationInSeconds,
    fps,
    width,
    height,
    palette,
    brief,
    ownerAssetPaths,
    stockAssetPaths,
    contentArea,
    scenes: Array.isArray(input?.scenes) ? input.scenes : []
  }
}

function normalizeExplainerScene(scene, index, fps) {
  const type = ALLOWED_EXPLAINER_SCENE_TYPES.has(String(scene?.type ?? '').trim())
    ? String(scene.type).trim()
    : 'problem_flow'

  return {
    id: slugify(scene?.id ?? `${type}-${index + 1}`) || `${type}-${index + 1}`,
    type,
    durationFrames: Math.max(18, Number(scene?.durationFrames ?? Math.round(fps * 2.8))),
    primaryAsset: scene?.primaryAsset ? String(scene.primaryAsset).trim() : null,
    supportingAssets: Array.isArray(scene?.supportingAssets)
      ? scene.supportingAssets.map((value) => String(value).trim()).filter(Boolean)
      : [],
    headline: String(scene?.headline ?? '').trim(),
    subheadline: String(scene?.subheadline ?? '').trim(),
    kicker: String(scene?.kicker ?? '').trim(),
    align: ALLOWED_ALIGN.has(String(scene?.align ?? '').trim()) ? String(scene.align).trim() : 'left',
    overlayStyle: ALLOWED_OVERLAY_STYLES.has(String(scene?.overlayStyle ?? '').trim())
      ? String(scene.overlayStyle).trim()
      : 'soft_panel',
    motionStyle: ALLOWED_MOTION_STYLES.has(String(scene?.motionStyle ?? '').trim())
      ? String(scene.motionStyle).trim()
      : 'steady',
    items: Array.isArray(scene?.items) ? scene.items.map((value) => String(value).trim()).filter(Boolean) : [],
    paths: Array.isArray(scene?.paths) ? scene.paths.map((value) => String(value).trim()).filter(Boolean) : [],
    outcomes: Array.isArray(scene?.outcomes)
      ? scene.outcomes.map((value) => String(value).trim()).filter(Boolean)
      : [],
    highlightedPath: String(scene?.highlightedPath ?? '').trim(),
    state: ALLOWED_EXPLAINER_STATE.has(String(scene?.state ?? '').trim())
      ? String(scene.state).trim()
      : 'mixed'
  }
}

function normalizeExplainerScenes(scenes, fps) {
  return scenes.map((scene, index) => normalizeExplainerScene(scene, index, fps))
}

function assetSearchText(asset) {
  return [
    asset?.localPath,
    asset?.sourcePath,
    asset?.title,
    asset?.creatorName,
    asset?.assetType,
    asset?.providerAssetId
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isWeakExplainerAsset(asset) {
  const text = assetSearchText(asset)
  return [
    /profile|portrait|headshot|founder|selfie|handstand|handstands|outdoor-handstand|seb/i,
    /woman|man|people|person|team|entrepreneur|brainstorming|group|chair|jacket/i,
    /futuristic|command center|sci-fi|digital displays/i
  ].some((pattern) => pattern.test(text))
}

function scoreExplainerAsset(serviceType, asset, phase = 'problem') {
  const text = assetSearchText(asset)
  let score = 0

  if (isWeakExplainerAsset(asset)) score -= 100
  if (asset?.provider === 'pexels') score += 8
  if (/dashboard|admin|ops|workspace|monitor|laptop|computer|screen|system/i.test(text)) score += 18
  if (/crm|m365|api|integration|sync|workflow|automation|openai|chatgpt|excel|booking/i.test(text)) score += 12
  if (/jpg|jpeg|png/i.test(text)) score += 1

  if (serviceType === 'integration') {
    if (/integration|crm|m365|api|excel|booking|workspace|monitor|system|screen|computer/i.test(text)) score += 24
    if (/dashboard|admin|ops/i.test(text)) score += phase === 'outcome' ? 18 : 8
  } else if (serviceType === 'automation') {
    if (/automation|workflow|openai|chatgpt|system|screen|workspace|monitor/i.test(text)) score += 22
    if (/dashboard|ops|admin/i.test(text)) score += phase === 'outcome' ? 18 : 8
  } else if (serviceType === 'internal_tools') {
    if (/dashboard|admin|ops|internal|tool|screen|workspace|monitor/i.test(text)) score += 24
  } else {
    if (/system|screen|workspace|monitor|dashboard|ops/i.test(text)) score += 12
  }

  return score
}

function serviceAssetPriority(serviceType, assets, phase = 'problem') {
  return [...assets]
    .map((asset) => ({ asset, score: scoreExplainerAsset(serviceType, asset, phase) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.asset)
}

function pickExplainerAsset(assets, serviceType, phase) {
  const ranked = serviceAssetPriority(serviceType, assets, phase)
  const best = ranked[0] ?? null
  if (!best) return null
  if (scoreExplainerAsset(serviceType, best, phase) < 10) return null
  return best
}

function chooseExplainerVisuals(serviceType, ownerAssets, stockAssets) {
  const safeOwner = ownerAssets.filter((asset) => !isWeakExplainerAsset(asset))
  const safeStock = stockAssets.filter((asset) => !isWeakExplainerAsset(asset))
  const all = [...safeStock, ...safeOwner]

  const problemVisual = pickExplainerAsset(all, serviceType, 'problem')
  const decisionVisual = pickExplainerAsset(
    all.filter((asset) => asset?.localPath !== problemVisual?.localPath),
    serviceType,
    'decision'
  )
  const outcomeVisual = pickExplainerAsset(
    all.filter((asset) => ![problemVisual?.localPath, decisionVisual?.localPath].includes(asset?.localPath)),
    serviceType,
    'outcome'
  )
  const support = all.filter((asset) => {
    const localPath = asset?.localPath
    if (!localPath) return false
    return ![problemVisual?.localPath, decisionVisual?.localPath, outcomeVisual?.localPath].includes(localPath)
  })

  return {
    problemVisual,
    decisionVisual,
    outcomeVisual,
    support
  }
}

function defaultServiceExplainerScenes(input, ownerAssets, stockAssets) {
  const rankedOwner = serviceAssetPriority(input.serviceType, filterAssetsForContentArea(ownerAssets, input.contentArea))
  const rankedStock = serviceAssetPriority(input.serviceType, filterAssetsForContentArea(stockAssets, input.contentArea))
  const { problemVisual, decisionVisual, outcomeVisual, support } = chooseExplainerVisuals(
    input.serviceType,
    rankedOwner,
    rankedStock
  )

  const totalFrames = Math.round(input.durationInSeconds * input.fps)
  const firstFrames = Math.round(totalFrames * 0.35)
  const secondFrames = Math.round(totalFrames * 0.3)
  const thirdFrames = Math.max(totalFrames - firstFrames - secondFrames, Math.round(input.fps * 2))

  if (input.mode === 'before_after') {
    return normalizeExplainerScenes(
      [
        {
          type: 'problem_flow',
          durationFrames: Math.round(totalFrames / 2),
          primaryAsset: problemVisual?.localPath ?? null,
          headline: input.brief.problem || 'Det fastnar i manuella steg',
          subheadline: input.brief.decision || 'Först behöver vi se var det bryter ihop.',
          kicker: input.serviceType,
          items: ['Formulär', 'Mejl', 'CRM', 'Uppföljning'],
          state: 'broken'
        },
        {
          type: 'outcome_dashboard',
          durationFrames: Math.max(Math.round(totalFrames / 2), Math.round(input.fps * 2)),
          primaryAsset: outcomeVisual?.localPath ?? null,
          supportingAssets: support.map((asset) => asset.localPath),
          headline: input.brief.outcome || 'Sedan blir flödet tydligare',
          subheadline: 'Status, automation och uppföljning blir enklare att se.',
          kicker: input.serviceType,
          outcomes: ['Mindre manuellt arbete', 'Bättre överblick', 'Snabbare uppföljning']
        }
      ],
      input.fps
    )
  }

  return normalizeExplainerScenes(
    [
      {
        type: 'problem_flow',
        durationFrames: firstFrames,
        primaryAsset: problemVisual?.localPath ?? null,
        headline: input.brief.problem || 'Det fastnar i manuella steg',
        subheadline: 'För många handoffs och för lite tydlighet i vad som händer sen.',
        kicker: input.serviceType || 'problem',
        items: ['Formulär', 'Mejl', 'CRM', 'Uppföljning'],
        state: 'broken'
      },
      {
        type: 'decision_router',
        durationFrames: secondFrames,
        primaryAsset: decisionVisual?.localPath ?? null,
        headline: input.brief.decision || 'Vi väljer rätt första steg',
        subheadline: 'Inte mer brus. Bara rätt riktning först.',
        kicker: 'decision',
        paths: ['Automation', 'Integration', 'Internt verktyg'],
        highlightedPath:
          input.serviceType === 'integration'
            ? 'Integration'
            : input.serviceType === 'internal_tools'
              ? 'Internt verktyg'
              : 'Automation'
      },
      {
        type: 'outcome_dashboard',
        durationFrames: thirdFrames,
        primaryAsset: outcomeVisual?.localPath ?? null,
        supportingAssets: support.map((asset) => asset.localPath),
        headline: input.brief.outcome || 'Ni får ett tydligare flöde',
        subheadline: 'Mindre manuellt arbete, bättre överblick och ett lugnare operativt läge.',
        kicker: 'outcome',
        outcomes: ['Mindre manuellt arbete', 'Bättre överblick', 'Snabbare uppföljning']
      }
    ],
    input.fps
  )
}

function normalizeScene(scene, index, fps) {
  const type = ALLOWED_SCENE_TYPES.has(String(scene?.type ?? '').trim())
    ? String(scene.type).trim()
    : 'headline_overlay'

  return {
    id: slugify(scene?.id ?? `${type}-${index + 1}`) || `${type}-${index + 1}`,
    type,
    durationFrames: Math.max(12, Number(scene?.durationFrames ?? Math.round(fps * 1.8))),
    primaryAsset: scene?.primaryAsset ? String(scene.primaryAsset).trim() : null,
    supportingAssets: Array.isArray(scene?.supportingAssets)
      ? scene.supportingAssets.map((value) => String(value).trim()).filter(Boolean)
      : [],
    headline: String(scene?.headline ?? '').trim(),
    subheadline: String(scene?.subheadline ?? '').trim(),
    kicker: String(scene?.kicker ?? '').trim(),
    align: ALLOWED_ALIGN.has(String(scene?.align ?? '').trim()) ? String(scene.align).trim() : 'left',
    overlayStyle: ALLOWED_OVERLAY_STYLES.has(String(scene?.overlayStyle ?? '').trim())
      ? String(scene.overlayStyle).trim()
      : 'dark_gradient',
    motionStyle: ALLOWED_MOTION_STYLES.has(String(scene?.motionStyle ?? '').trim())
      ? String(scene.motionStyle).trim()
      : 'steady'
  }
}

function normalizeCustomScenes(scenes, fps) {
  return scenes.map((scene, index) => normalizeScene(scene, index, fps))
}

function defaultScenePlan(input, ownerAssets, stockAssets, previewAssets) {
  const allOwner = rankAssetsForFocus(filterAssetsForContentArea(ownerAssets, input.contentArea), input.focus)
  const allStock = rankAssetsForFocus(filterAssetsForContentArea(stockAssets, input.contentArea), input.focus)
  const allPreviews = rankAssetsForFocus(filterAssetsForContentArea(previewAssets, input.contentArea), input.focus)

  const supportCount = supportCountForPace(input.pace)
  const hero =
    (input.focus === 'product'
      ? allPreviews[0] ?? allStock[0] ?? allOwner[0]
      : allOwner[0] ?? allPreviews[0] ?? allStock[0]) ?? null
  const supportPool = [...allStock, ...allPreviews, ...allOwner].filter((asset) => asset?.localPath !== hero?.localPath)
  const support = supportPool.slice(0, supportCount)
  const introFrames = input.template === 'founder_intro' ? Math.round(input.fps * 2.6) : Math.round(input.fps * 2.2)
  const headlineFrames = Math.round(input.fps * (input.pace === 'fast' ? 1.3 : 1.8))
  const remainderFrames = Math.max(
    Math.round(input.durationInSeconds * input.fps) - introFrames - headlineFrames,
    Math.round(input.fps * 1.2)
  )
  const headline = input.title
  const subheadline =
    input.cta || (input.focus === 'product' ? 'Show the product signal quickly and clearly.' : 'Make the strongest visual statement first.')
  const kicker = input.contentArea ? `${input.contentArea}` : input.template.replace(/_/g, ' ')

  if (input.template === 'founder_intro') {
    return [
      normalizeScene(
        {
          id: 'founder-closeup',
          type: 'founder_closeup',
          durationFrames: introFrames,
          primaryAsset: hero?.localPath ?? null,
          headline,
          subheadline,
          kicker: input.cta || 'Founder story',
          align: 'left',
          overlayStyle: 'dark_gradient',
          motionStyle: 'slow_push'
        },
        0,
        input.fps
      ),
      normalizeScene(
        {
          id: 'founder-message',
          type: 'headline_overlay',
          durationFrames: headlineFrames,
          headline: 'Founder-led systems thinking',
          subheadline: input.cta || 'Turn attention into credibility before you ask for action.',
          kicker,
          align: 'center',
          overlayStyle: 'soft_panel',
          motionStyle: 'steady'
        },
        1,
        input.fps
      ),
      normalizeScene(
        {
          id: 'founder-proof',
          type: 'proof_grid',
          durationFrames: remainderFrames,
          primaryAsset: hero?.localPath ?? null,
          supportingAssets: support.map((asset) => asset.localPath),
          headline: 'Build trust fast',
          subheadline: 'Mix founder presence with supporting proof and visual signal.',
          kicker,
          align: 'left',
          overlayStyle: 'none',
          motionStyle: 'steady'
        },
        2,
        input.fps
      )
    ]
  }

  if (input.template === 'product_story') {
    const productHero = allPreviews[0] ?? allStock[0] ?? hero
    return [
      normalizeScene(
        {
          id: 'product-headline',
          type: 'headline_overlay',
          durationFrames: headlineFrames,
          headline,
          subheadline,
          kicker: input.cta || 'Product story',
          align: 'center',
          overlayStyle: 'soft_panel',
          motionStyle: 'steady'
        },
        0,
        input.fps
      ),
      normalizeScene(
        {
          id: 'product-split',
          type: 'device_focus',
          durationFrames: introFrames,
          primaryAsset: productHero?.localPath ?? null,
          supportingAssets: support.map((asset) => asset.localPath),
          headline,
          subheadline: 'Lead with the clearest product surface and keep proof adjacent.',
          kicker,
          align: 'left',
          overlayStyle: 'none',
          motionStyle: 'drift_left'
        },
        1,
        input.fps
      ),
      normalizeScene(
        {
          id: 'product-proof',
          type: 'proof_grid',
          durationFrames: remainderFrames,
          primaryAsset: productHero?.localPath ?? hero?.localPath ?? null,
          supportingAssets: support.map((asset) => asset.localPath),
          headline: 'Show the system',
          subheadline: input.cta || 'Proof, UI and atmosphere should reinforce the product story.',
          kicker,
          align: 'left',
          overlayStyle: 'none',
          motionStyle: 'steady'
        },
        2,
        input.fps
      )
    ]
  }

  if (input.template === 'case_strip') {
    return [
      normalizeScene(
        {
          id: 'case-intro',
          type: 'headline_overlay',
          durationFrames: headlineFrames,
          headline,
          subheadline,
          kicker: input.cta || 'Highlights',
          align: 'center',
          overlayStyle: 'soft_panel',
          motionStyle: 'steady'
        },
        0,
        input.fps
      ),
      normalizeScene(
        {
          id: 'case-photo',
          type: 'full_bleed_photo',
          durationFrames: introFrames,
          primaryAsset: support[0]?.localPath ?? hero?.localPath ?? null,
          headline: input.title,
          subheadline: 'Lead one beat with a single strong image before the strip opens up.',
          kicker,
          align: 'left',
          overlayStyle: 'dark_gradient',
          motionStyle: 'drift_right'
        },
        1,
        input.fps
      ),
      normalizeScene(
        {
          id: 'case-grid',
          type: 'ambient_logo_strip',
          durationFrames: remainderFrames,
          primaryAsset: support[0]?.localPath ?? hero?.localPath ?? null,
          supportingAssets: support.map((asset) => asset.localPath),
          headline: 'Proof in motion',
          subheadline: 'Use a compact grid when the pace is high and the content is varied.',
          kicker,
          align: 'left',
          overlayStyle: 'none',
          motionStyle: 'steady'
        },
        2,
        input.fps
      )
    ]
  }

  return [
    normalizeScene(
      {
        id: 'signal-hero',
        type: 'full_bleed_photo',
        durationFrames: introFrames,
        primaryAsset: hero?.localPath ?? null,
        headline,
        subheadline,
        kicker: input.cta || 'Startup signal',
        align: 'left',
        overlayStyle: 'dark_gradient',
        motionStyle: 'slow_push'
      },
      0,
      input.fps
    ),
    normalizeScene(
      {
        id: 'signal-message',
        type: 'headline_overlay',
        durationFrames: headlineFrames,
        headline: 'Signal first. Clarity second.',
        subheadline: input.cta || 'Use bold framing to make the next action obvious.',
        kicker,
        align: 'center',
        overlayStyle: 'soft_panel',
        motionStyle: 'steady'
      },
      1,
      input.fps
    ),
    normalizeScene(
      {
        id: 'signal-proof',
        type: 'ambient_logo_strip',
        durationFrames: remainderFrames,
        primaryAsset: hero?.localPath ?? null,
        supportingAssets: support.map((asset) => asset.localPath),
        headline: 'Layer proof, not clutter',
        subheadline: 'Use multiple supporting images to build signal without losing focus.',
        kicker,
        align: 'left',
        overlayStyle: 'none',
        motionStyle: 'steady'
      },
      2,
      input.fps
    )
  ]
}

async function appendRenderManifest(projectDir, manifestEntry) {
  const manifestPath = path.resolve(projectDir, 'manifest.json')
  let manifest = { generatedAt: nowIso(), jobs: [] }

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  } catch {
    manifest = { generatedAt: nowIso(), jobs: [] }
  }

  const nextJobs = Array.isArray(manifest.jobs)
    ? manifest.jobs.filter((entry) => entry.jobId !== manifestEntry.jobId)
    : []
  nextJobs.push(manifestEntry)
  manifest.generatedAt = nowIso()
  manifest.jobs = nextJobs

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
}

async function runProcess(command, args, cwd) {
  const stdout = []
  const stderr = []

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout.on('data', (chunk) => {
      stdout.push(String(chunk))
    })

    child.stderr.on('data', (chunk) => {
      stderr.push(String(chunk))
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `Process exited with code ${code}\n${stdout.join('').trim()}\n${stderr.join('').trim()}`.trim()
        )
      )
    })
  })

  return {
    stdout: stdout.join(''),
    stderr: stderr.join('')
  }
}

async function tryExecuteDockerRender(jobPath, plannedOutputPath) {
  return tryExecuteDockerRenderWithImage(jobPath, plannedOutputPath, remotionDockerImage)
}

async function tryExecuteDockerRenderWithImage(jobPath, plannedOutputPath, image) {
  const relativeJobPath = path.relative(repoRoot, jobPath).replaceAll(path.sep, '/')
  const containerJobPath = `/workspace/operator-hub/${relativeJobPath}`

  try {
    await runProcess(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${hostRepoRoot}:/workspace/operator-hub`,
        '-w',
        '/workspace',
        image,
        'npm',
        'run',
        'render:job',
        '--',
        '--job',
        containerJobPath
      ],
      repoRoot
    )

    return {
      attempted: true,
      mode: 'docker',
      image,
      ok: existsSync(plannedOutputPath),
      outputPath: existsSync(plannedOutputPath) ? relativeLocalPath(plannedOutputPath) : null,
      error: existsSync(plannedOutputPath) ? null : 'Docker render completed without producing the planned output file.'
    }
  } catch (error) {
    return {
      attempted: true,
      mode: 'docker',
      image,
      ok: false,
      outputPath: null,
      error: error instanceof Error ? error.message : 'Docker render failed'
    }
  }
}

export async function renderSiteHeroMotion(input) {
  const normalized = normalizeRenderInput(input)
  const projectDir = path.resolve(motionRoot, normalized.projectSlug)
  await mkdir(projectDir, { recursive: true })

  const ownerManifestAssets = await loadManifestAssets(ownerMediaRoot, normalized.projectSlug)
  const stockManifestAssets = await loadManifestAssets(stockMediaRoot, normalized.projectSlug)
  const previewManifestAssets = await loadManifestAssets(previewMediaRoot, normalized.projectSlug)

  const ownerAssets =
    normalized.ownerAssetPaths.length > 0
      ? normalized.ownerAssetPaths.map((assetPath) => ({
          localPath: relativeLocalPath(resolveExistingAssetPath(ownerMediaRoot, assetPath))
        }))
      : ownerManifestAssets

  const stockAssets =
    normalized.stockAssetPaths.length > 0
      ? normalized.stockAssetPaths.map((assetPath) => ({
          localPath: relativeLocalPath(resolveExistingAssetPath(stockMediaRoot, assetPath))
        }))
      : stockManifestAssets

  const previewAssets =
    normalized.previewAssetPaths.length > 0
      ? normalized.previewAssetPaths.map((assetPath) => ({
          localPath: relativeLocalPath(resolveExistingAssetPath(previewMediaRoot, assetPath))
        }))
      : previewManifestAssets

  const jobId = `${normalized.projectSlug}-${sha(JSON.stringify(normalized)).slice(0, 12)}`
  const composition = {
    id: 'site-hero-motion',
    title: normalized.title,
    style: normalized.style,
    motion: buildMotionMeta(normalized),
    fps: normalized.fps,
    width: normalized.width,
    height: normalized.height,
    durationInFrames: Math.round(normalized.durationInSeconds * normalized.fps),
    assets: {
      owner: ownerAssets,
      stock: stockAssets,
      previews: previewAssets
    },
    scenes:
      normalized.scenes.length > 0
        ? normalizeCustomScenes(normalized.scenes, normalized.fps)
        : defaultScenePlan(normalized, ownerAssets, stockAssets, previewAssets)
  }

  const compositionPath = path.resolve(projectDir, `${jobId}.composition.json`)
  const jobPath = path.resolve(projectDir, `${jobId}.job.json`)
  const plannedOutputPath = path.resolve(projectDir, `${jobId}.mp4`)

  const job = {
    jobId,
    status: 'planned',
    renderer: 'pending-remotion-runtime',
    createdAt: nowIso(),
    projectSlug: normalized.projectSlug,
    title: normalized.title,
    compositionPath: relativeLocalPath(compositionPath),
    plannedOutputPath: relativeLocalPath(plannedOutputPath),
    diagnostics: {
      ownerAssetCount: ownerAssets.length,
      stockAssetCount: stockAssets.length,
      previewAssetCount: previewAssets.length
    }
  }

  await writeFile(compositionPath, `${JSON.stringify(composition, null, 2)}\n`, 'utf-8')
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf-8')
  const renderExecution = await tryExecuteDockerRender(jobPath, plannedOutputPath)

  const finalStatus = renderExecution.ok ? 'rendered' : job.status
  await appendRenderManifest(projectDir, {
    jobId,
    status: finalStatus,
    title: job.title,
    compositionPath: job.compositionPath,
    plannedOutputPath: job.plannedOutputPath,
    createdAt: job.createdAt,
    renderedOutputPath: renderExecution.outputPath
  })

  return {
    ok: true,
    projectSlug: normalized.projectSlug,
    renderJob: {
      jobId,
      status: finalStatus,
      compositionPath: job.compositionPath,
      plannedOutputPath: job.plannedOutputPath
    },
    renderExecution,
    composition,
    savedTo: relativeLocalPath(projectDir),
    notes: [
      renderExecution.ok
        ? 'Dockerized Remotion worker rendered the planned output successfully.'
        : 'A bounded local render job plan was created. Docker render can be retried when the worker image is available.',
      '@remotion/mcp can help an AI assistant understand Remotion docs, but it is not the renderer.'
    ]
  }
}

export async function renderServiceExplainerMotion(input) {
  const normalized = normalizeServiceExplainerInput(input)
  const projectDir = path.resolve(serviceExplainerRoot, normalized.projectSlug)
  await mkdir(projectDir, { recursive: true })

  const ownerManifestAssets = await loadManifestAssets(ownerMediaRoot, normalized.projectSlug)
  const stockManifestAssets = await loadManifestAssets(stockMediaRoot, normalized.projectSlug)

  const ownerAssets =
    normalized.ownerAssetPaths.length > 0
      ? normalized.ownerAssetPaths.map((assetPath) => ({
          localPath: relativeLocalPath(resolveExistingAssetPath(ownerMediaRoot, assetPath))
        }))
      : ownerManifestAssets

  const stockAssets =
    normalized.stockAssetPaths.length > 0
      ? normalized.stockAssetPaths.map((assetPath) => ({
          localPath: relativeLocalPath(resolveExistingAssetPath(stockMediaRoot, assetPath))
        }))
      : stockManifestAssets

  const jobId = `${normalized.projectSlug}-${sha(JSON.stringify(normalized)).slice(0, 12)}`
  const composition = {
    id: 'service-explainer-motion',
    title: normalized.title,
    mode: normalized.mode,
    serviceType: normalized.serviceType,
    fps: normalized.fps,
    width: normalized.width,
    height: normalized.height,
    durationInFrames: Math.round(normalized.durationInSeconds * normalized.fps),
    palette: normalized.palette,
    brief: normalized.brief,
    assets: {
      owner: ownerAssets,
      stock: stockAssets
    },
    scenes:
      normalized.scenes.length > 0
        ? normalizeExplainerScenes(normalized.scenes, normalized.fps)
        : defaultServiceExplainerScenes(normalized, ownerAssets, stockAssets),
    motion: buildServiceExplainerMeta(normalized),
    pace: normalized.pace
  }

  const compositionPath = path.resolve(projectDir, `${jobId}.composition.json`)
  const jobPath = path.resolve(projectDir, `${jobId}.job.json`)
  const plannedOutputPath = path.resolve(projectDir, `${jobId}.mp4`)

  const job = {
    jobId,
    status: 'planned',
    renderer: 'pending-remotion-runtime',
    createdAt: nowIso(),
    projectSlug: normalized.projectSlug,
    title: normalized.title,
    compositionPath: relativeLocalPath(compositionPath),
    plannedOutputPath: relativeLocalPath(plannedOutputPath),
    diagnostics: {
      ownerAssetCount: ownerAssets.length,
      stockAssetCount: stockAssets.length,
      sceneCount: composition.scenes.length,
      mode: normalized.mode,
      serviceType: normalized.serviceType
    }
  }

  await writeFile(compositionPath, `${JSON.stringify(composition, null, 2)}\n`, 'utf-8')
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf-8')
  const renderExecution = await tryExecuteDockerRenderWithImage(jobPath, plannedOutputPath, serviceExplainerDockerImage)

  const finalStatus = renderExecution.ok ? 'rendered' : job.status
  await appendRenderManifest(projectDir, {
    jobId,
    status: finalStatus,
    title: job.title,
    compositionPath: job.compositionPath,
    plannedOutputPath: job.plannedOutputPath,
    createdAt: job.createdAt,
    renderedOutputPath: renderExecution.outputPath
  })

  return {
    ok: true,
    projectSlug: normalized.projectSlug,
    renderJob: {
      jobId,
      status: finalStatus,
      compositionPath: job.compositionPath,
      plannedOutputPath: job.plannedOutputPath
    },
    renderExecution,
    composition: {
      id: composition.id,
      mode: composition.mode,
      serviceType: composition.serviceType,
      tone: normalized.tone
    },
    savedTo: relativeLocalPath(projectDir),
    notes: [
      'This renderer is designed for service explanation and process storytelling, not hero loops.',
      'Assets should come from local owner-media or collected stock-media; external freeform URLs are not used directly in the composition.',
      renderExecution.ok
        ? 'Dockerized Remotion worker rendered the planned output successfully.'
        : 'A bounded local render job plan was created. Build the service-explainer worker image to render the MP4.'
    ]
  }
}
