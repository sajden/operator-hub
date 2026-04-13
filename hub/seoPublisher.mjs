/**
 * seoPublisher.mjs
 *
 * Publishes an approved SEO draft to sebcastwall:
 *   1. Writes MDX to sebcastwall/content/articles/<slug>.mdx
 *   2. git add + commit + push in sebcastwall repo
 *   3. POST /api/revalidate on live site
 *   4. Updates draft status to 'published'
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
  const date = (draft.generatedAt ?? new Date().toISOString()).slice(0, 10)
  const tags = (draft.tags ?? []).map((t) => JSON.stringify(t)).join(', ')
  const wordCount = (draft.body ?? '').split(/\s+/).length
  const readingTime = `${Math.max(1, Math.round(wordCount / 200))} min läsning`

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(draft.title ?? '')}`,
    `slug: ${JSON.stringify(draft.slug)}`,
    `description: ${JSON.stringify(draft.metaDescription ?? '')}`,
    `metaDescription: ${JSON.stringify(draft.metaDescription ?? '')}`,
    `category: "SEO"`,
    `site: "seb-castwall-personal-site"`,
    `date: "${date}"`,
    `readingTime: "${readingTime}"`,
    `tags: [${tags}]`,
    '---',
  ].join('\n')

  // Strip leading H1 from body if it duplicates the title (Next.js renders title separately)
  const body = (draft.body ?? '').replace(/^#\s+.+\n/, '').trimStart()

  return `${frontmatter}\n\n${body}\n`
}

export async function publishDraft(slug) {
  const draftPath = path.join(draftsDir, `${slug}.json`)
  let draft
  try {
    draft = JSON.parse(await readFile(draftPath, 'utf-8'))
  } catch {
    throw new Error(`Draft not found: ${slug}`)
  }

  if (draft.status === 'published') {
    throw new Error(`Draft already published: ${slug}`)
  }

  // 1. Write MDX
  await mkdir(ARTICLES_DIR, { recursive: true })
  const mdxPath = path.join(ARTICLES_DIR, `${slug}.mdx`)
  const mdxContent = buildMdx(draft)
  await writeFile(mdxPath, mdxContent, 'utf-8')
  console.log(`[seo-publisher] Wrote MDX: ${mdxPath}`)

  // 2. Git commit + push
  const relMdxPath = path.relative(SEBCASTWALL_REPO, mdxPath)
  try {
    await runGit(['add', relMdxPath], SEBCASTWALL_REPO)
    await runGit(
      ['commit', '-m', `content: add SEO article "${draft.title}"`],
      SEBCASTWALL_REPO
    )
    await runGit(['push'], SEBCASTWALL_REPO)
    console.log(`[seo-publisher] Git pushed: ${relMdxPath}`)
  } catch (e) {
    console.error(`[seo-publisher] Git error: ${e.message}`)
    throw new Error(`Git push failed: ${e.message}`)
  }

  // 3. Revalidate live site (optional — skip if not configured)
  if (REVALIDATE_URL && REVALIDATE_SECRET) {
    try {
      const url = `${REVALIDATE_URL}?secret=${encodeURIComponent(REVALIDATE_SECRET)}&path=/artiklar/${slug}`
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000) })
      if (!res.ok) console.warn(`[seo-publisher] Revalidate returned ${res.status}`)
      else console.log(`[seo-publisher] Revalidated /artiklar/${slug}`)
    } catch (e) {
      console.warn(`[seo-publisher] Revalidate failed (non-fatal): ${e.message}`)
    }
  }

  // 4. Update draft status
  draft.status = 'published'
  draft.publishedAt = new Date().toISOString()
  await writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf-8')

  return { slug, mdxPath: relMdxPath, publishedAt: draft.publishedAt }
}
