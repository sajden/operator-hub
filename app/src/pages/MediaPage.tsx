import { useEffect, useMemo, useState, useRef, useCallback, type ChangeEvent } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import {
  collectOwnerMediaFromProject,
  collectStockMedia,
  createOwnerMediaFolder,
  loadOwnerMediaProject,
  loadServiceExplainerRenders,
  loadSiteHeroRenders,
  searchStockMedia,
  uploadOwnerMediaFile
} from '../data/plannerClient'
import { withAppBase } from '../data/runtimePaths'
import type { OwnerMediaProjectPayload, StockMediaSearchResult } from '../types/planner'

// ── Types ──────────────────────────────────────────────────────────────────

type SkillSignal = 'all' | 'follow_up' | 'avoidance' | 'high_priority'

interface MediaFile {
  collection: string
  album: string
  fileName: string
  sizeBytes: number
  isVideo: boolean
  mimeType: string
  fileUrl: string
}

interface CollectionInfo {
  id: string
  label: string
  albums: string[]
}

interface Gallery {
  videos: MediaFile[]
  images: MediaFile[]
  collections: CollectionInfo[]
}

interface MediaPageProps {
  onNavigate: (path: string) => void
}

interface CombinedRenderVideo {
  kind: 'hero' | 'service_explainer'
  fileName: string
  path: string
  sizeBytes: number
  modifiedAt: string
  streamUrl: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const BASE = '/operatorhub-app'
const DEFAULT_PROJECT_SLUG = 'seb-castwall-site'

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const [, data = ''] = result.split(',', 2)
      resolve(data)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MediaPage({ onNavigate }: MediaPageProps) {
  const [mainTab, setMainTab] = useState<'gallery' | 'project'>('gallery')
  const [signal, setSignal] = useState<SkillSignal>('all')

  function handleWorkspaceChange(workspace: string) {
    const routes: Record<string, string> = {
      dashboard: '/', daily: '/boards/daily', week: '/week', parkpal: '/parkpal',
      connections: '/connections', skills: '/skills', research: '/research',
      media: '/media', 'service-explainer': '/service-explainer', ha: '/ha', tv: '/tv', 'bg-remover': '/bg-remover',
    }
    if (routes[workspace]) onNavigate(routes[workspace])
  }

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="media" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <PlannerTopbar
          title="Media"
          subtitle="Galleri, uppladdning och Remotion-renders"
          workspace="media"
          signal={signal}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
        />

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', background: '#e0eef0', borderRadius: '8px', padding: '3px', margin: '0 24px 0', width: 'fit-content' }}>
          {(['gallery', 'project'] as const).map(t => (
            <button key={t} type="button" onClick={() => setMainTab(t)} style={{
              background: mainTab === t ? 'white' : 'none',
              border: 'none', borderRadius: '6px', padding: '7px 18px',
              fontSize: '0.85rem', fontWeight: 600,
              color: mainTab === t ? '#136a78' : '#607d8b',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: mainTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}>
              {t === 'gallery' ? 'Galleri' : 'Projekt & renders'}
            </button>
          ))}
        </div>

        {mainTab === 'gallery'
          ? <GalleryTab />
          : <ProjectTab />
        }
      </main>
    </div>
  )
}

// ── Gallery tab ────────────────────────────────────────────────────────────

function GalleryTab() {
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<string>('all')
  const [tab, setTab] = useState<'images' | 'videos'>('images')
  const [loading, setLoading] = useState(false)
  const [uploadAlbum, setUploadAlbum] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ collection: 'assets' })
      if (selectedAlbum !== 'all') params.set('album', selectedAlbum)
      const r = await fetch(`${BASE}/api/media/gallery?${params}`)
      if (r.ok) setGallery(await r.json() as Gallery)
    } finally {
      setLoading(false)
    }
  }, [selectedAlbum])

  useEffect(() => { void load() }, [load])

  // Sync upload album with selected album when it changes
  useEffect(() => {
    if (selectedAlbum !== 'all') setUploadAlbum(selectedAlbum)
  }, [selectedAlbum])

  const assetsCollection = gallery?.collections.find(c => c.id === 'assets')
  const albums = assetsCollection?.albums ?? []
  const files = tab === 'images' ? (gallery?.images ?? []) : (gallery?.videos ?? [])

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (!uploadAlbum) { setUploadError('Välj en mapp att ladda upp till'); return }
    setUploading(true); setUploadError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`${i + 1}/${files.length} — ${file.name}`)
        const dataBase64 = await fileToBase64(file)
        await uploadOwnerMediaFile({
          projectSlug: DEFAULT_PROJECT_SLUG,
          fileName: file.name,
          targetDir: uploadAlbum,
          dataBase64,
        })
      }
      setUploadProgress(null)
      await load()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Uppladdning misslyckades')
      setUploadProgress(null)
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  return (
    <div style={{ padding: '16px 24px', display: 'grid', gap: '16px' }}>
      {/* Upload row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: '#f5f9fa', borderRadius: '10px', padding: '10px 14px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#455d61' }}>Ladda upp till</span>
        <select value={uploadAlbum} onChange={e => setUploadAlbum(e.target.value)}
          style={{ border: '1px solid #d2dde0', borderRadius: '6px', padding: '5px 10px', fontSize: '0.83rem', background: 'white', fontFamily: 'inherit', color: '#102027' }}>
          <option value="">— välj mapp —</option>
          {albums.filter(a => a !== '').map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <label style={{
          background: uploadAlbum ? '#136a78' : '#b0bec5',
          color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px',
          fontSize: '0.82rem', fontWeight: 600, cursor: uploadAlbum ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', display: 'inline-block',
        }}>
          <input ref={uploadRef} type="file" accept="image/*,video/*" multiple
            style={{ display: 'none' }} disabled={uploading || !uploadAlbum}
            onChange={e => void handleUpload(e)} />
          {uploading ? (uploadProgress ?? 'Laddar upp…') : 'Välj filer'}
        </label>
        {uploadError && <span style={{ fontSize: '0.78rem', color: '#c62828' }}>{uploadError}</span>}
      </div>

      {/* Album chips + view toggle */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['all', ...albums.filter(a => a !== '')].map(a => (
            <button key={a} type="button" onClick={() => setSelectedAlbum(a)} style={{
              background: selectedAlbum === a ? '#136a78' : '#e0eef0',
              color: selectedAlbum === a ? 'white' : '#455d61',
              border: 'none', borderRadius: '20px', padding: '5px 14px',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
              {a === 'all' ? 'Alla' : a}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => void load()} disabled={loading}
          style={{ ...btnStyle('#607d8b'), padding: '5px 12px', fontSize: '0.8rem' }}>
          {loading ? '…' : '↻'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', background: '#e0eef0', borderRadius: '8px', padding: '3px' }}>
          {(['images', 'videos'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              background: tab === t ? 'white' : 'none',
              border: 'none', borderRadius: '6px', padding: '6px 14px',
              fontSize: '0.83rem', fontWeight: 600,
              color: tab === t ? '#136a78' : '#607d8b',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
              {t === 'images' ? `Bilder (${gallery?.images.length ?? 0})` : `Videor (${gallery?.videos.length ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {files.length === 0 && !loading ? (
        <div style={{ color: '#90a4ae', fontSize: '0.85rem', padding: '20px 0' }}>
          Inga {tab === 'images' ? 'bilder' : 'videor'} hittades.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: tab === 'videos'
            ? 'repeat(auto-fill, minmax(280px, 1fr))'
            : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '14px',
        }}>
          {files.map(f => (
            <MediaCard key={`${f.collection}/${f.album}/${f.fileName}`} file={f} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Media card ─────────────────────────────────────────────────────────────

function MediaCard({ file, onRefresh }: { file: MediaFile; onRefresh: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(file.fileName)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const url = `${BASE}${file.fileUrl}`

  useEffect(() => {
    if (renaming) { setNewName(file.fileName); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [renaming, file.fileName])

  async function handleRename() {
    if (!newName.trim() || newName === file.fileName) { setRenaming(false); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch(`${BASE}/api/media/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: file.collection, album: file.album, fileName: file.fileName, newName: newName.trim() }),
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? 'Fel') }
      setRenaming(false)
      onRefresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Fel') }
    finally { setBusy(false) }
  }

  async function handleDelete() {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`${BASE}/api/media/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: file.collection, album: file.album, fileName: file.fileName }),
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? 'Fel') }
      onRefresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Fel') }
    finally { setBusy(false); setConfirmDelete(false) }
  }

  const collectionColor: Record<string, string> = {
    'no-bg': '#136a78', 'raw': '#607d8b', 'assets': '#455d61',
  }

  return (
    <div style={{ background: 'white', border: '1px solid #d2dde0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'repeating-conic-gradient(#ddd 0% 25%, #f5f5f5 0% 50%) 0 0/16px 16px', position: 'relative', flexShrink: 0 }}>
        {file.isVideo ? (
          <video src={url} controls muted preload="metadata"
            style={{ width: '100%', display: 'block', maxHeight: '160px', objectFit: 'cover' }} />
        ) : (
          <img src={url} alt={file.fileName} loading="lazy"
            style={{ width: '100%', display: 'block', maxHeight: '160px', objectFit: 'cover' }} />
        )}
        {file.album && (
          <span style={{
            position: 'absolute', top: '6px', left: '6px',
            background: 'rgba(0,0,0,0.55)',
            color: 'white', fontSize: '0.66rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>
            {file.album}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 12px', display: 'grid', gap: '8px', flex: 1 }}>
        {renaming ? (
          <div style={{ display: 'flex', gap: '5px' }}>
            <input ref={inputRef} value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleRename(); if (e.key === 'Escape') setRenaming(false) }}
              style={{ flex: 1, border: '1px solid #136a78', borderRadius: '5px', padding: '4px 7px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
            <button type="button" onClick={() => void handleRename()} disabled={busy} style={btnStyle('#136a78')}>✓</button>
            <button type="button" onClick={() => setRenaming(false)} style={btnStyle('#90a4ae')}>✕</button>
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#102027' }}
            title={file.fileName}>{file.fileName}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#90a4ae' }}>{fmtSize(file.sizeBytes)}</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {!renaming && (
              <button type="button" onClick={() => setRenaming(true)} style={btnStyle('#607d8b')}>✏️</button>
            )}
            {confirmDelete ? (
              <>
                <button type="button" onClick={() => void handleDelete()} disabled={busy} style={btnStyle('#c62828')}>Ja</button>
                <button type="button" onClick={() => setConfirmDelete(false)} style={btnStyle('#90a4ae')}>Nej</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} style={btnStyle('#c62828')}>🗑</button>
            )}
          </div>
        </div>
        {error && <div style={{ fontSize: '0.73rem', color: '#c62828' }}>{error}</div>}
      </div>
    </div>
  )
}

// ── Project tab (original functionality) ──────────────────────────────────

function ProjectTab() {
  const [projectSlug, setProjectSlug] = useState(DEFAULT_PROJECT_SLUG)
  const [projectSlugDraft, setProjectSlugDraft] = useState(DEFAULT_PROJECT_SLUG)
  const [ownerProject, setOwnerProject] = useState<OwnerMediaProjectPayload | null>(null)
  const [renders, setRenders] = useState<{ projectSlug: string; renderRoot: string; videos: CombinedRenderVideo[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [collectingOwner, setCollectingOwner] = useState(false)
  const [searchingStock, setSearchingStock] = useState(false)
  const [collectingStock, setCollectingStock] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [targetDir, setTargetDir] = useState('profile')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [stockQuery, setStockQuery] = useState('founder portrait natural light')
  const [stockResults, setStockResults] = useState<StockMediaSearchResult[]>([])
  const [stockErrors, setStockErrors] = useState<Array<{ provider: string; message: string }>>([])

  async function refresh() {
    setBusy(true)
    try {
      setError(null)
      const [loadedOwnerProject, loadedHeroRenders, loadedServiceRenders] = await Promise.all([
        loadOwnerMediaProject(projectSlug),
        loadSiteHeroRenders(projectSlug),
        loadServiceExplainerRenders(projectSlug)
      ])
      setOwnerProject(loadedOwnerProject)
      setRenders({
        projectSlug,
        renderRoot: [loadedHeroRenders.renderRoot, loadedServiceRenders.renderRoot].filter(Boolean).join(' | '),
        videos: [
          ...loadedHeroRenders.videos.map((video) => ({ ...video, kind: 'hero' as const })),
          ...loadedServiceRenders.videos.map((video) => ({ ...video, kind: 'service_explainer' as const }))
        ].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load media')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [projectSlug])

  const rawGroups = useMemo(() => {
    const groups: Record<string, NonNullable<OwnerMediaProjectPayload['rawFiles']>> = {}
    for (const file of ownerProject?.rawFiles ?? []) {
      const [prefix = 'raw'] = file.relativePath.split('/', 1)
      groups[prefix] ??= []
      groups[prefix].push(file)
    }
    return groups
  }, [ownerProject])

  const uploadDirectories = useMemo(() => {
    const directories = ['']
    for (const directory of ownerProject?.rawDirectories ?? []) directories.push(directory)
    if (!directories.includes(targetDir)) directories.push(targetDir)
    return [...new Set(directories)]
  }, [ownerProject, targetDir])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setUploading(true); setNotice(null); setError(null)
    try {
      for (const file of files) {
        const dataBase64 = await fileToBase64(file)
        await uploadOwnerMediaFile({ projectSlug, fileName: file.name, targetDir, dataBase64 })
      }
      setNotice(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'} to raw/${targetDir}`)
      await refresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      event.target.value = ''
      setUploading(false)
    }
  }

  async function handleCollectOwner() {
    setCollectingOwner(true); setNotice(null); setError(null)
    try {
      const result = await collectOwnerMediaFromProject({
        projectSlug,
        assetTypes: ['profile'],
        maxAssets: ownerProject?.rawFiles.length ?? undefined
      })
      setNotice(`Collected ${result.assets.length} owner asset${result.assets.length === 1 ? '' : 's'}`)
      await refresh()
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Owner collection failed')
    } finally {
      setCollectingOwner(false)
    }
  }

  function applyProjectSlug() {
    const normalized = projectSlugDraft.trim().toLowerCase()
    if (!normalized || normalized === projectSlug) return
    setProjectSlug(normalized)
    setTargetDir('profile')
    setNewFolderPath('')
    setStockResults([])
    setStockErrors([])
    setNotice(null)
    setError(null)
  }

  async function handleCreateFolder() {
    if (!newFolderPath.trim()) return
    setCreatingFolder(true); setNotice(null); setError(null)
    try {
      const response = await createOwnerMediaFolder({ projectSlug, folderPath: newFolderPath })
      setNotice(`Created folder raw/${response.folderPath}`)
      setTargetDir(response.folderPath)
      setNewFolderPath('')
      await refresh()
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : 'Folder creation failed')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleSearchStock() {
    setSearchingStock(true); setNotice(null); setError(null)
    try {
      const result = await searchStockMedia({
        query: stockQuery,
        providers: ['pexels', 'unsplash'],
        orientation: 'portrait',
        maxResults: 8
      })
      setStockResults(result.results)
      setStockErrors(result.errors)
      if (result.results.length === 0 && result.errors.length === 0) setNotice('No stock results found')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Stock search failed')
    } finally {
      setSearchingStock(false)
    }
  }

  async function handleCollectStock(result: StockMediaSearchResult) {
    if (!result.sourceUrl || !result.downloadUrl) return
    setCollectingStock(result.id); setNotice(null); setError(null)
    try {
      const response = await collectStockMedia({
        projectSlug,
        selections: [{
          provider: result.provider, id: result.id, assetType: result.assetType,
          title: result.title, sourceUrl: result.sourceUrl, downloadUrl: result.downloadUrl,
          creatorName: result.creatorName, creatorUrl: result.creatorUrl, license: result.license
        }]
      })
      if (response.assets.length > 0) setNotice(`Collected stock asset: ${response.assets[0].title}`)
      else if (response.errors.length > 0) setError(response.errors[0].message)
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Stock collect failed')
    } finally {
      setCollectingStock(null)
    }
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {error ? <div className="planner-inline-notice">{error}</div> : null}
      {notice ? <div className="planner-inline-notice">{notice}</div> : null}

      <section className="planner-media-layout">
        <section className="planner-media-column">
          <article className="planner-media-panel">
            <div className="planner-media-panel-head">
              <div>
                <span className="planner-widget-eyebrow">Owner media</span>
                <h2>{projectSlug}</h2>
              </div>
              <button type="button" onClick={() => void handleCollectOwner()} disabled={collectingOwner || !ownerProject?.rawFiles.length}>
                {collectingOwner ? 'Collecting...' : 'Collect raw -> assets'}
              </button>
            </div>

            <div className="planner-media-upload-row">
              <label className="planner-topbar-control">
                <span>Project</span>
                <input value={projectSlugDraft} onChange={e => setProjectSlugDraft(e.target.value)} />
              </label>
              <button type="button" onClick={applyProjectSlug}
                disabled={!projectSlugDraft.trim() || projectSlugDraft.trim().toLowerCase() === projectSlug}>
                Open project
              </button>
              <label className="planner-topbar-control">
                <span>Upload to</span>
                <select value={targetDir} onChange={e => setTargetDir(e.target.value)}>
                  {uploadDirectories.map(d => (
                    <option key={d || 'raw-root'} value={d}>{d || 'raw root'}</option>
                  ))}
                </select>
              </label>
              <label className="planner-media-upload-button">
                <input type="file" accept="image/*" multiple onChange={e => void handleUpload(e)} disabled={uploading} />
                {uploading ? 'Uploading...' : 'Upload images'}
              </label>
            </div>

            <div className="planner-media-stock-form">
              <input value={newFolderPath} onChange={e => setNewFolderPath(e.target.value)}
                placeholder="parkpal/hero or campaign/summer" />
              <button type="button" onClick={() => void handleCreateFolder()}
                disabled={creatingFolder || !newFolderPath.trim()}>
                {creatingFolder ? 'Creating...' : 'Create folder'}
              </button>
            </div>

            <div className="planner-media-grid">
              <div className="planner-media-subpanel">
                <div className="planner-media-subhead">
                  <strong>Raw files</strong>
                  <span>{ownerProject?.rawFiles.length ?? 0}</span>
                </div>
                {Object.entries(rawGroups).map(([group, files]) => (
                  <div key={group} className="planner-media-file-group">
                    <strong>{group}</strong>
                    <div className="planner-media-file-list">
                      {files.map(file => (
                        <div key={file.relativePath} className="planner-media-file-row">
                          <span>{file.relativePath}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="planner-media-subpanel">
                <div className="planner-media-subhead">
                  <strong>Collected assets</strong>
                  <span>{ownerProject?.collectedAssets.length ?? 0}</span>
                </div>
                <div className="planner-media-asset-list">
                  {(ownerProject?.collectedAssets ?? []).map(asset => (
                    <div key={asset.localPath} className="planner-media-asset-row">
                      <div>
                        <strong>{asset.sourcePath ?? asset.sourceUrl}</strong>
                        <span>{asset.localPath}</span>
                      </div>
                      <span>{asset.width ?? '?'} x {asset.height ?? '?'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="planner-media-subpanel">
                <div className="planner-media-subhead">
                  <strong>Rendered videos</strong>
                  <span>{renders?.videos.length ?? 0}</span>
                </div>
                <div className="planner-media-asset-list">
                  {(renders?.videos ?? []).map(video => (
                    <div key={video.path} className="planner-media-render-card">
                      <video controls preload="metadata" className="planner-media-video"
                        src={withAppBase(video.streamUrl)} />
                      <div className="planner-media-asset-row">
                        <div>
                          <strong>{video.fileName}</strong>
                          <span>{video.path}</span>
                        </div>
                        <div style={{ display: 'grid', justifyItems: 'end', gap: '4px' }}>
                          <span>{Math.max(1, Math.round(video.sizeBytes / 1024 / 1024))} MB</span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: video.kind === 'hero' ? '#136a78' : '#8c6b1f', background: video.kind === 'hero' ? '#e4f4f5' : '#f7edd2', padding: '3px 7px', borderRadius: '999px' }}>
                            {video.kind === 'hero' ? 'Hero motion' : 'Service explainer'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(renders?.videos.length ?? 0) === 0 ? (
                    <div className="planner-media-empty">No rendered videos yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside className="planner-media-column planner-media-column-side">
          <article className="planner-media-panel">
            <div className="planner-media-panel-head">
              <div>
                <span className="planner-widget-eyebrow">Stock search</span>
                <h2>Search bounded providers</h2>
              </div>
            </div>

            <div className="planner-media-stock-form">
              <input value={stockQuery} onChange={e => setStockQuery(e.target.value)}
                placeholder="confident founder portrait natural light" />
              <button type="button" onClick={() => void handleSearchStock()}
                disabled={searchingStock || !stockQuery.trim()}>
                {searchingStock ? 'Searching...' : 'Search stock'}
              </button>
            </div>

            {stockErrors.length > 0 ? (
              <div className="planner-media-provider-errors">
                {stockErrors.map(entry => (
                  <div key={`${entry.provider}-${entry.message}`} className="planner-media-provider-error">
                    <strong>{entry.provider}</strong>
                    <span>{entry.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="planner-media-stock-results">
              {stockResults.map(result => (
                <div key={`${result.provider}-${result.id}`} className="planner-media-stock-card">
                  <div className="planner-media-stock-card-head">
                    <strong>{result.title}</strong>
                    <span>{result.provider}</span>
                  </div>
                  {result.previewUrl ? <img src={result.previewUrl} alt={result.title} /> : null}
                  <div className="planner-media-stock-meta">
                    <span>{result.creatorName ?? 'Unknown creator'}</span>
                    <span>{result.width ?? '?'} x {result.height ?? '?'}</span>
                  </div>
                  <div className="planner-media-stock-actions">
                    {result.sourceUrl ? (
                      <a href={result.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
                    ) : null}
                    <button type="button" onClick={() => void handleCollectStock(result)}
                      disabled={collectingStock === result.id || !result.downloadUrl || !result.sourceUrl}>
                      {collectingStock === result.id ? 'Collecting...' : 'Collect stock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────

const eyebrowStyle: React.CSSProperties = {
  fontSize: '0.78rem', color: '#607d8b', fontWeight: 600,
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #d2dde0', borderRadius: '6px', padding: '5px 10px',
  fontSize: '0.83rem', background: 'white', fontFamily: 'inherit', color: '#102027',
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: color, color: 'white', border: 'none',
    borderRadius: '5px', padding: '4px 8px', fontSize: '0.78rem',
    cursor: 'pointer', fontFamily: 'inherit',
  }
}
