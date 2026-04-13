/**
 * seoPublisher.mjs
 *
 * Publishes, updates, and deletes SEO drafts in sebcastwall.
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const draftsDir = path.resolve(repoRoot, '.local/seo-drafts')

const SEBCASTWALL_REPO = process.env.SEO_PUBLISH_REPO ?? '/home/sajden/github/sebcastwall'
const ARTICLES_DIR = path.join(SEBCASTWALL_REPO, 'content/articles')
const REVALIDATE_URL = process.env.SEO_REVALIDATE_URL ?? ''
const REVALIDATE_SECRET = process.env.SEO_REVALIDATE_SECRET ?? ''

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr.trim()}`))
    })
  })
}

function buildMdx(draft) {
  const date = (draft.publishedAt ?? draft.generatedAt ?? new Date().toISOString()).slice(0, 10)
  const tags = (draft.tags ?? []).map((t) => JSON.stringify(t)).join(', ')
  const wordCount = (draft.body ?? '').split(/\s+/).length
  const readingTime = `${Math.max(1, Math.round(wordCount / 200))} min läsning`
  const category = draft.category ?? 'SEO'

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(draft.title ?? '')}`,
    `slug: ${JSON.stringify(draft.slug)}`,
    `description: ${JSON.stringify(draft.metaDescription ?? '')}`,
    `metaDescription: ${JSON.stringify(draft.metaDescription ?? '')}`,
    `category: ${JSON.stringify(category)}`,
    `site: "seb-castwall-personal-site"`,
    `date: "${date}"`,
    `readingTime: "${readingTime}"`,
    `tags: [${tags}]`,
    '---',
  ].join('\n')

  const body = (draft.body ?? '').replace(/^#\s+.+\n/, '').trimStart()
  return `${frontmatter}\n\n${body}\n`
}

async function readDraft(slug) {
  const draftPath = path.join(draftsDir, `${slug}.json`)
  try {
    return { draft: JSON.parse(await readFile(draftPath, 'utf-8')), draftPath }
  } catch {
    throw new Error(`Draft not found: ${slug}`)
  }
}

async function writeDraft(draftPath, draft) {
  await writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf-8')
}

async function writeMdx(draft) {
  await mkdir(ARTICLES_DIR, { recursive: true })
  const mdxPath = path.join(ARTICLES_DIR, `${draft.slug}.mdx`)
  await writeFile(mdxPath, buildMdx(draft), 'utf-8')
  return mdxPath
}

async function gitCommitPush(relPath, message) {
  await runGit(['add', relPath], SEBCASTWALL_REPO)
  await runGit(['commit', '-m', message], SEBCASTWALL_REPO)
  await runGit(['push'], SEBCASTWALL_REPO)
}

async function revalidate(slug) {
  if (!REVALIDATE_URL || !REVALIDATE_SECRET) return
  try {
    const url = `${REVALIDATE_URL}?secret=${encodeURIComponent(REVALIDATE_SECRET)}&path=/artiklar/${slug}`
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000) })
    if (!res.ok) console.warn(`[seo-publisher] Revalidate returned ${res.status}`)
    else console.log(`[seo-publisher] Revalidated /artiklar/${slug}`)
  } catch (e) {
    console.warn(`[seo-publisher] Revalidate failed (non-fatal): ${e.message}`)
  }
}

export async function publishDraft(slug) {
  const { draft, draftPath } = await readDraft(slug)
  if (draft.status === 'published') throw new Error(`Already published: ${slug}`)

  const mdxPath = await writeMdx(draft)
  const relMdxPath = path.relative(SEBCASTWALL_REPO, mdxPath)

  try {
    await gitCommitPush(relMdxPath, `content: add SEO article "${draft.title}"`)
  } catch (e) {
    throw new Error(`Git push failed: ${e.message}`)
  }

  await revalidate(slug)

  draft.status = 'published'
  draft.publishedAt = new Date().toISOString()
  await writeDraft(draftPath, draft)

  return { slug, mdxPath: relMdxPath, publishedAt: draft.publishedAt }
}

export async function updateDraft(slug, updates) {
  const { draft, draftPath } = await readDraft(slug)

  if (updates.title !== undefined) draft.title = updates.title
  if (updates.metaDescription !== undefined) draft.metaDescription = updates.metaDescription
  if (updates.category !== undefined) draft.category = updates.category
  if (updates.tags !== undefined) draft.tags = updates.tags
  if (updates.body !== undefined) draft.body = updates.body
  draft.updatedAt = new Date().toISOString()

  await writeDraft(draftPath, draft)

  // If published, also update the MDX
  if (draft.status === 'published') {
    const mdxPath = await writeMdx(draft)
    const relMdxPath = path.relative(SEBCASTWALL_REPO, mdxPath)
    try {
      await gitCommitPush(relMdxPath, `content: update SEO article "${draft.title}"`)
      await revalidate(slug)
    } catch (e) {
      console.warn(`[seo-publisher] Git push failed during update (non-fatal): ${e.message}`)
    }
  }

  return draft
}

export async function unpublishDraft(slug) {
  const { draft, draftPath } = await readDraft(slug)
  if (draft.status !== 'published') throw new Error(`Not published: ${slug}`)

  const mdxPath = path.join(ARTICLES_DIR, `${slug}.mdx`)
  const relMdxPath = path.relative(SEBCASTWALL_REPO, mdxPath)

  if (existsSync(mdxPath)) {
    await unlink(mdxPath)
    try {
      await runGit(['rm', '--cached', relMdxPath], SEBCASTWALL_REPO).catch(() =>
        runGit(['add', relMdxPath], SEBCASTWALL_REPO)
      )
      await runGit(['commit', '-m', `content: remove SEO article "${draft.title}"`], SEBCASTWALL_REPO)
      await runGit(['push'], SEBCASTWALL_REPO)
    } catch (e) {
      console.warn(`[seo-publisher] Git push failed during unpublish: ${e.message}`)
    }
    await revalidate(slug)
  }

  draft.status = 'approved'
  draft.publishedAt = null
  draft.updatedAt = new Date().toISOString()
  await writeDraft(draftPath, draft)

  return { slug, unpublished: true }
}
