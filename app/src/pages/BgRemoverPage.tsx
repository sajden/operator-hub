import { useEffect, useRef, useState, useCallback } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'

const MODELS = [
  { id: 'u2net_human_seg', label: 'Human Seg', desc: 'Optimerad för människor & porträtt' },
  { id: 'u2net', label: 'u2net', desc: 'Generell – bra för de flesta motiv' },
  { id: 'u2netp', label: 'u2netp (snabb)', desc: 'Snabbare men något lägre kvalitet' },
] as const

const ACCEPTED = '.jpg,.jpeg,.png,.heic,.heif,.mp4,.mov,.webm,.gif'
const IS_IMAGE = /\.(jpg|jpeg|png|heic|heif)$/i
const IS_VIDEO = /\.(mp4|mov|webm|gif)$/i

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const [, data = ''] = String(reader.result ?? '').split(',', 2)
      resolve(data)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function fmtSeconds(s: number) {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function uid() {
  return Math.random().toString(36).slice(2)
}

interface FileItem {
  localId: string
  file: File
  previewUrl: string
  isImage: boolean
  jobId?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  message: string
  progress: number
  elapsed: number
  resultMime?: string
  resultFileName?: string
  error?: string
}

interface JobPollResp {
  status: 'processing' | 'done' | 'error'
  message: string
  progress: number
  elapsed: number
  resultMime?: string
  resultFileName?: string
  error?: string
}

interface WatcherJob {
  fileName: string
  status: 'queued' | 'processing' | 'done' | 'error'
  message: string
  progress: number
  elapsed?: number
  outputFileName?: string
  error?: string
  detectedAt: number
}

interface WatcherStatus {
  inputDir: string
  outputDir: string
  jobs: WatcherJob[]
}

interface BgRemoverPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

async function downloadBlob(url: string, fileName: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
}

export default function BgRemoverPage({ onNavigate }: BgRemoverPageProps) {
  const [items, setItems] = useState<FileItem[]>([])
  const [model, setModel] = useState<string>('u2net_human_seg')
  const [alphaMatting, setAlphaMatting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')
  const [watcher, setWatcher] = useState<WatcherStatus | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const processingRef = useRef(false)

  const fetchWatcher = useCallback(async () => {
    try {
      const r = await fetch('/operatorhub-app/api/bg-remover/watcher')
      if (r.ok) setWatcher(await r.json() as WatcherStatus)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    void fetchWatcher()
    const t = setInterval(fetchWatcher, 4000)
    return () => {
      clearInterval(t)
      pollsRef.current.forEach(p => clearInterval(p))
    }
  }, [fetchWatcher])

  function updateItem(localId: string, patch: Partial<FileItem>) {
    setItems(prev => prev.map(it => it.localId === localId ? { ...it, ...patch } : it))
  }

  function addFiles(files: FileList | File[]) {
    const newItems: FileItem[] = []
    for (const f of Array.from(files)) {
      if (!IS_IMAGE.test(f.name) && !IS_VIDEO.test(f.name)) continue
      newItems.push({
        localId: uid(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        isImage: IS_IMAGE.test(f.name),
        status: 'pending',
        message: 'Väntar…',
        progress: 0,
        elapsed: 0,
      })
    }
    setItems(prev => [...prev, ...newItems])
  }

  function removeItem(localId: string) {
    setItems(prev => {
      const it = prev.find(i => i.localId === localId)
      if (it) URL.revokeObjectURL(it.previewUrl)
      const t = pollsRef.current.get(localId)
      if (t) { clearInterval(t); pollsRef.current.delete(localId) }
      return prev.filter(i => i.localId !== localId)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function startJob(item: FileItem) {
    updateItem(item.localId, { status: 'processing', message: 'Laddar upp…', progress: 0 })
    try {
      const dataBase64 = await fileToBase64(item.file)
      const res = await fetch('/operatorhub-app/api/bg-remover/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataBase64, fileName: item.file.name, model, alphaMatting }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? `Fel: ${res.status}`)
      }
      const { jobId } = await res.json() as { jobId: string }
      updateItem(item.localId, { jobId, message: 'Bearbetar…' })

      await new Promise<void>((resolve, reject) => {
        const t = setInterval(async () => {
          try {
            const r = await fetch(`/operatorhub-app/api/bg-remover/status/${jobId}`)
            const s = await r.json() as JobPollResp
            updateItem(item.localId, {
              message: s.message,
              progress: s.progress,
              elapsed: s.elapsed,
            })
            if (s.status === 'done') {
              clearInterval(t)
              pollsRef.current.delete(item.localId)
              updateItem(item.localId, {
                status: 'done',
                progress: 100,
                message: 'Klar!',
                resultMime: s.resultMime,
                resultFileName: s.resultFileName,
              })
              resolve()
            } else if (s.status === 'error') {
              clearInterval(t)
              pollsRef.current.delete(item.localId)
              updateItem(item.localId, { status: 'error', error: s.error ?? 'Okänt fel', message: 'Fel' })
              reject(new Error(s.error))
            }
          } catch { /* network glitch */ }
        }, 2000)
        pollsRef.current.set(item.localId, t)
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      updateItem(item.localId, { status: 'error', error: msg, message: 'Fel' })
    }
  }

  async function processAll() {
    if (processingRef.current) return
    processingRef.current = true
    // Get snapshot of pending items at this moment
    const pending = items.filter(it => it.status === 'pending')
    for (const item of pending) {
      await startJob(item)
    }
    processingRef.current = false
  }

  async function downloadAll() {
    const done = items.filter(it => it.status === 'done' && it.jobId && it.resultFileName)
    for (let i = 0; i < done.length; i++) {
      const it = done[i]
      await downloadBlob(`/operatorhub-app/api/bg-remover/result/${it.jobId}`, it.resultFileName!)
      if (i < done.length - 1) await new Promise(r => setTimeout(r, 400))
    }
  }

  function handleWorkspaceChange(workspace: string) {
    const routes: Record<string, string> = {
      dashboard: '/', daily: '/boards/daily', week: '/week', parkpal: '/parkpal',
      connections: '/connections', skills: '/skills', research: '/research',
      media: '/media', 'service-explainer': '/service-explainer', ha: '/ha', tv: '/tv',
    }
    if (routes[workspace]) onNavigate(routes[workspace])
  }

  const pendingCount = items.filter(it => it.status === 'pending').length
  const processingCount = items.filter(it => it.status === 'processing').length
  const doneCount = items.filter(it => it.status === 'done').length
  const anyPending = pendingCount > 0
  const anyProcessing = processingCount > 0
  const allImages = items.every(it => it.isImage)

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="bg-remover" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <PlannerTopbar
          title="BG Remover"
          subtitle="Ta bort bakgrund från bilder och videos med AI"
          workspace="bg-remover"
          signal={signal}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          utilityActionLabel={anyPending ? `Bearbeta ${pendingCount} fil${pendingCount > 1 ? 'er' : ''}` : undefined}
          utilityActionBusyLabel="Bearbetar…"
          utilityActionPending={anyProcessing}
          onUtilityAction={anyPending ? () => void processAll() : undefined}
        />

        <div style={{ padding: '24px', display: 'grid', gap: '20px', maxWidth: '960px' }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#136a78' : '#b0c4c8'}`,
              borderRadius: '12px', padding: '28px', textAlign: 'center',
              cursor: 'pointer', background: dragging ? 'rgba(19,106,120,0.04)' : 'white',
              transition: 'all 0.15s',
            }}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: 'none' }}
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🎬</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Dra hit filer eller klicka för att välja — flera filer stöds
            </div>
            <div style={{ fontSize: '0.8rem', color: '#78909c', marginTop: '4px' }}>
              MP4 · MOV · GIF · JPG · PNG · HEIC
            </div>
          </div>

          {/* Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div className="eyebrow">Modell</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {MODELS.map(m => (
                  <label key={m.id} style={{
                    border: `2px solid ${model === m.id ? '#136a78' : '#d2dde0'}`,
                    borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                    background: model === m.id ? 'rgba(19,106,120,0.05)' : 'white',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="model" value={m.id} checked={model === m.id}
                      onChange={() => setModel(m.id)} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: model === m.id ? '#136a78' : '#102027' }}>{m.label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#607d8b', marginTop: '2px' }}>{m.desc}</div>
                  </label>
                ))}
              </div>
            </div>
            {allImages && items.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingTop: '24px', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={alphaMatting} onChange={e => setAlphaMatting(e.target.checked)} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Alpha Matting</div>
                  <div style={{ fontSize: '0.74rem', color: '#607d8b' }}>Fina kanter (hår, päls)</div>
                </div>
              </label>
            )}
          </div>

          {/* Action buttons */}
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void processAll()}
                disabled={!anyPending || anyProcessing}
                style={{
                  background: anyPending && !anyProcessing ? '#136a78' : '#90a4ae',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '10px 22px',
                  fontSize: '0.92rem', fontWeight: 600,
                  cursor: anyPending && !anyProcessing ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}>
                {anyProcessing ? '⏳ Bearbetar…' : `✨ Bearbeta ${pendingCount > 0 ? pendingCount + ' fil' + (pendingCount > 1 ? 'er' : '') : 'alla'}`}
              </button>
              {doneCount > 1 && (
                <button type="button" onClick={() => void downloadAll()} style={{
                  background: 'white', border: '2px solid #136a78', color: '#136a78',
                  borderRadius: '8px', padding: '9px 18px', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  ⬇ Ladda ner alla ({doneCount})
                </button>
              )}
              {!anyProcessing && (
                <button type="button" onClick={() => setItems([])} style={{
                  background: 'none', border: 'none', color: '#78909c', fontSize: '0.85rem',
                  cursor: 'pointer', fontFamily: 'inherit', padding: '8px',
                }}>
                  Rensa
                </button>
              )}
            </div>
          )}

          {/* File list */}
          {items.length > 0 && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {items.map(item => (
                <FileRow
                  key={item.localId}
                  item={item}
                  onRemove={() => removeItem(item.localId)}
                  onDownload={() => void downloadBlob(
                    `/operatorhub-app/api/bg-remover/result/${item.jobId}`,
                    item.resultFileName!
                  )}
                />
              ))}
            </div>
          )}
          {/* Folder watcher */}
          {watcher && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="eyebrow">Mapp-läge</div>
                <div style={{ fontSize: '0.74rem', color: '#78909c' }}>Uppdateras automatiskt var 4:e sek</div>
              </div>
              <div style={{ background: '#f0f7f8', border: '1px solid #d2dde0', borderRadius: '8px', padding: '12px 14px', fontSize: '0.8rem', display: 'grid', gap: '4px' }}>
                <div><span style={{ color: '#607d8b' }}>Input: </span><code style={{ fontSize: '0.78rem' }}>{watcher.inputDir}</code></div>
                <div><span style={{ color: '#607d8b' }}>Output: </span><code style={{ fontSize: '0.78rem' }}>{watcher.outputDir}</code></div>
                <div style={{ fontSize: '0.74rem', color: '#90a4ae', marginTop: '2px' }}>
                  Lägg klipp i input-mappen — de bearbetas automatiskt och sparas i output-mappen.
                </div>
              </div>
              {watcher.jobs.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#90a4ae', padding: '8px 0' }}>Inga filer detekterade än…</div>
              ) : (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {watcher.jobs.map(job => (
                    <WatcherRow key={job.fileName} job={job} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function WatcherRow({ job }: { job: WatcherJob }) {
  const statusColor = job.status === 'done' ? '#2e7d32' : job.status === 'error' ? '#c62828' : job.status === 'processing' ? '#136a78' : '#78909c'
  const statusIcon = job.status === 'done' ? '✅' : job.status === 'error' ? '❌' : job.status === 'processing' ? '⏳' : '⏸'
  return (
    <div style={{ background: 'white', border: '1px solid #d2dde0', borderRadius: '8px', padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.fileName}</div>
        {job.status === 'processing' && job.progress > 0 && (
          <div style={{ marginTop: '5px', height: '4px', borderRadius: '2px', background: '#e0eef0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${job.progress}%`, background: '#136a78', borderRadius: '2px', transition: 'width 0.4s' }} />
          </div>
        )}
        {job.outputFileName && (
          <div style={{ fontSize: '0.74rem', color: '#607d8b', marginTop: '3px' }}>→ {job.outputFileName}</div>
        )}
        {job.error && (
          <div style={{ fontSize: '0.74rem', color: '#c62828', marginTop: '3px' }}>{job.error}</div>
        )}
      </div>
      <div style={{ fontSize: '0.78rem', color: statusColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {statusIcon} {job.status === 'processing' && job.progress > 0 ? `${job.progress}%` : job.message}
        {job.elapsed != null && job.elapsed > 0 && job.status === 'processing' && (
          <span style={{ color: '#90a4ae', fontWeight: 400, marginLeft: '6px' }}>⏱ {fmtSeconds(job.elapsed)}</span>
        )}
      </div>
    </div>
  )
}

function FileRow({ item, onRemove, onDownload }: {
  item: FileItem
  onRemove: () => void
  onDownload: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const resultUrl = item.status === 'done' && item.jobId
    ? `/operatorhub-app/api/bg-remover/result/${item.jobId}` : null

  const statusColor = item.status === 'done' ? '#2e7d32'
    : item.status === 'error' ? '#c62828'
    : item.status === 'processing' ? '#136a78'
    : '#78909c'

  const statusIcon = item.status === 'done' ? '✅'
    : item.status === 'error' ? '❌'
    : item.status === 'processing' ? '⏳'
    : '⏸'

  return (
    <div style={{
      background: 'white', border: '1px solid #d2dde0', borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Row header */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto auto', gap: '10px', alignItems: 'center', padding: '12px 14px' }}>
        {/* Thumbnail */}
        <div style={{ width: '40px', height: '36px', borderRadius: '4px', overflow: 'hidden', background: '#e0eef0', flexShrink: 0 }}>
          {item.isImage
            ? <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎬</div>
          }
        </div>

        {/* Name + status */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.file.name}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#607d8b', marginTop: '2px' }}>
            {(item.file.size / 1024 / 1024).toFixed(1)} MB
          </div>
          {item.status === 'processing' && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ height: '4px', borderRadius: '2px', background: '#e0eef0', overflow: 'hidden' }}>
                {item.progress > 0
                  ? <div style={{ height: '100%', width: `${item.progress}%`, background: '#136a78', borderRadius: '2px', transition: 'width 0.4s' }} />
                  : <div style={{ height: '100%', width: '30%', background: '#136a78', borderRadius: '2px', animation: 'bgr-pulse 1.5s ease-in-out infinite' }} />
                }
              </div>
            </div>
          )}
          {item.status === 'error' && (
            <div style={{ fontSize: '0.74rem', color: '#c62828', marginTop: '3px' }}>{item.error}</div>
          )}
        </div>

        {/* Status badge */}
        <div style={{ fontSize: '0.78rem', color: statusColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {statusIcon} {item.status === 'processing' ? (item.progress > 0 ? `${item.progress}%` : item.message) : item.message}
          {item.status === 'processing' && item.elapsed > 0 && (
            <span style={{ color: '#90a4ae', fontWeight: 400, marginLeft: '6px' }}>⏱ {fmtSeconds(item.elapsed)}</span>
          )}
        </div>

        {/* Download button */}
        {item.status === 'done' && (
          <button type="button" onClick={onDownload} style={{
            background: '#136a78', color: 'white', border: 'none',
            borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
            ⬇ Ladda ner
          </button>
        )}

        {/* Expand / remove */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {item.status === 'done' && (
            <button type="button" onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: '1px solid #d2dde0', borderRadius: '6px',
              padding: '5px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#607d8b',
            }}>
              {expanded ? '▲' : '▼'}
            </button>
          )}
          {item.status !== 'processing' && (
            <button type="button" onClick={onRemove} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', color: '#90a4ae', padding: '4px 6px',
            }}>×</button>
          )}
        </div>
      </div>

      {/* Expanded preview */}
      {expanded && resultUrl && (
        <div style={{ borderTop: '1px solid #e0eef0', padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#607d8b', marginBottom: '5px', fontWeight: 600 }}>Original</div>
              {item.isImage
                ? <img src={item.previewUrl} alt="original" style={{ width: '100%', borderRadius: '6px', border: '1px solid #d2dde0' }} />
                : <video src={item.previewUrl} controls muted style={{ width: '100%', borderRadius: '6px', border: '1px solid #d2dde0' }} />
              }
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#607d8b', marginBottom: '5px', fontWeight: 600 }}>Utan bakgrund</div>
              <div style={{ borderRadius: '6px', border: '1px solid #d2dde0', overflow: 'hidden', background: 'repeating-conic-gradient(#ddd 0% 25%, #f5f5f5 0% 50%) 0 0/16px 16px' }}>
                {item.isImage
                  ? <img src={resultUrl} alt="result" style={{ width: '100%', display: 'block' }} />
                  : <video src={resultUrl} controls muted style={{ width: '100%', display: 'block' }} />
                }
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes bgr-pulse { 0%{margin-left:0%} 50%{margin-left:70%} 100%{margin-left:0%} }`}</style>
    </div>
  )
}
