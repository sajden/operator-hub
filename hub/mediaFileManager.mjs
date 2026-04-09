/**
 * mediaFileManager.mjs
 * Gallery management with album (subfolder) support: list, rename, delete.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const DEFAULT_PROJECT_SLUG = process.env.GALLERY_PROJECT_SLUG ?? 'seb-castwall-site'

export const COLLECTIONS = {
  'no-bg':  process.env.BG_WATCH_OUTPUT ?? '/workspace/bg-output',
  'raw':    process.env.BG_WATCH_INPUT  ?? '/workspace/bg-input',
  'assets': process.env.GALLERY_ASSETS_DIR
    ?? path.join(repoRoot, '.local', 'assets', 'owner-media', DEFAULT_PROJECT_SLUG, 'raw'),
}

const COLLECTION_LABELS = {
  'no-bg':  'Utan bakgrund',
  'raw':    'Råklipp',
  'assets': 'Projektfiler',
}

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.gif'])
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'])

const MIME = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.heic': 'image/heic', '.heif': 'image/heif', '.webp': 'image/webp',
}

function safeFileName(name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null
  return name
}

function safeAlbum(album) {
  if (!album) return null
  const parts = album.split('/')
  if (parts.some(p => !p || p === '..')) return null
  return album
}

export function collectionDir(collection) {
  return COLLECTIONS[collection] ?? null
}

/** List all albums (subdirs) within a collection. '' = root level. */
export function listAlbums(collection) {
  const base = collectionDir(collection)
  if (!base || !existsSync(base)) return ['']
  const albums = ['']
  try {
    for (const entry of readdirSync(base)) {
      const full = path.join(base, entry)
      try {
        if (statSync(full).isDirectory()) albums.push(entry)
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return albums
}

/** List files in a collection, optionally filtered by album (subdir). */
function listFiles(collection, album = '') {
  const base = collectionDir(collection)
  if (!base || !existsSync(base)) return []
  const dir = album ? path.join(base, album) : base
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir).flatMap(fileName => {
      const ext = path.extname(fileName).toLowerCase()
      if (!VIDEO_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) return []
      const fullPath = path.join(dir, fileName)
      try { statSync(fullPath) } catch { return [] }
      let sizeBytes = 0
      try { sizeBytes = statSync(fullPath).size } catch { /* ok */ }
      const isVideo = VIDEO_EXTS.has(ext)
      return [{
        collection,
        album,
        fileName,
        sizeBytes,
        isVideo,
        mimeType: MIME[ext] ?? 'application/octet-stream',
        fileUrl: `/api/media/file/${collection}/${album ? encodeURIComponent(album) + '/' : ''}${encodeURIComponent(fileName)}`,
      }]
    })
  } catch { return [] }
}

/** Returns gallery for a given collection + optional album filter. */
export function getGallery({ collection = null, album = null } = {}) {
  const collections = collection ? [collection] : Object.keys(COLLECTIONS)
  const all = collections.flatMap(col => {
    const albums = album !== null ? [album] : listAlbums(col)
    return albums.flatMap(alb => listFiles(col, alb))
  })
  all.sort((a, b) => a.fileName.localeCompare(b.fileName, 'sv'))
  return {
    videos: all.filter(f => f.isVideo),
    images: all.filter(f => !f.isVideo),
    collections: Object.keys(COLLECTIONS).map(id => ({
      id,
      label: COLLECTION_LABELS[id] ?? id,
      albums: listAlbums(id),
    })),
  }
}

export function resolveFilePath(collection, album, fileName) {
  if (!safeFileName(fileName)) return null
  if (album && !safeAlbum(album)) return null
  const base = collectionDir(collection)
  if (!base) return null
  const fullPath = album ? path.join(base, album, fileName) : path.join(base, fileName)
  if (!existsSync(fullPath)) return null
  return fullPath
}

export async function renameFile(collection, album, fileName, newName) {
  if (!safeFileName(fileName) || !safeFileName(newName)) throw new Error('Ogiltigt filnamn')
  if (album && !safeAlbum(album)) throw new Error('Ogiltig album-sökväg')
  const base = collectionDir(collection)
  if (!base) throw new Error('Okänd kollektion')
  const dir = album ? path.join(base, album) : base
  const oldPath = path.join(dir, fileName)
  const newPath = path.join(dir, newName)
  if (!existsSync(oldPath)) throw new Error('Filen finns inte')
  if (existsSync(newPath)) throw new Error('Det finns redan en fil med det namnet')
  await rename(oldPath, newPath)
  return { ok: true, newName }
}

export async function deleteFile(collection, album, fileName) {
  if (!safeFileName(fileName)) throw new Error('Ogiltigt filnamn')
  if (album && !safeAlbum(album)) throw new Error('Ogiltig album-sökväg')
  const base = collectionDir(collection)
  if (!base) throw new Error('Okänd kollektion')
  const fullPath = album
    ? path.join(base, album, fileName)
    : path.join(base, fileName)
  if (!existsSync(fullPath)) throw new Error('Filen finns inte')
  await unlink(fullPath)
  return { ok: true }
}

export async function createAlbum(collection, albumName) {
  if (!safeAlbum(albumName)) throw new Error('Ogiltigt albumnamn')
  const base = collectionDir(collection)
  if (!base) throw new Error('Okänd kollektion')
  await mkdir(path.join(base, albumName), { recursive: true })
  return { ok: true }
}
