import { useEffect, useMemo, useState } from 'react'
import type { GraphContentEntry, GraphFeedbackEntry, GraphOutreachEntry } from '../types/graph'

interface AudienceOption {
  id: string
  name: string
}

interface ContentPanelProps {
  content: GraphContentEntry[]
  feedback: GraphFeedbackEntry[]
  outreach: GraphOutreachEntry[]
  audiences: AudienceOption[]
  activeAudienceId: string
  selectedContentId?: string
  onSelectContent: (contentId: string) => void
  onCreateContent: (payload: Partial<GraphContentEntry>) => string
  onDuplicateContent: (contentId: string) => void
  onSetContentStatus: (contentId: string, status: string) => void
  onUpdateContentFields: (contentId: string, updates: Partial<GraphContentEntry>) => void
  onAddFeedback: (contentId: string, summary: string, nextStep: string) => void
}

function ContentPanel({
  content,
  feedback,
  outreach,
  audiences,
  activeAudienceId,
  selectedContentId,
  onSelectContent,
  onCreateContent,
  onDuplicateContent,
  onSetContentStatus,
  onUpdateContentFields,
  onAddFeedback
}: ContentPanelProps) {
  const [selectedAudienceId, setSelectedAudienceId] = useState(activeAudienceId)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [activeTab, setActiveTab] = useState<'drafts' | 'feedback'>('drafts')
  const [feedbackDraft, setFeedbackDraft] = useState('')
  const [nextStepDraft, setNextStepDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [docLinkDraft, setDocLinkDraft] = useState('')
  const [postedChannelDraft, setPostedChannelDraft] = useState('')
  const [postUrlDraft, setPostUrlDraft] = useState('')

  useEffect(() => {
    setSelectedAudienceId(activeAudienceId)
  }, [activeAudienceId])

  const outreachById = useMemo(() => new Map(outreach.map((entry) => [entry.id, entry])), [outreach])
  const categories = useMemo(() => {
    const values = new Set<string>()
    for (const entry of content) {
      const linkedOutreach = entry.outreachId ? outreachById.get(entry.outreachId) : undefined
      if (linkedOutreach?.channel) values.add(linkedOutreach.channel)
    }
    return Array.from(values).sort()
  }, [content, outreachById])

  const visibleContent = content.filter((entry) => {
    if (selectedAudienceId && entry.audienceId !== selectedAudienceId) return false
    if (selectedCategory) {
      const linkedOutreach = entry.outreachId ? outreachById.get(entry.outreachId) : undefined
      if ((linkedOutreach?.channel ?? '') !== selectedCategory) return false
    }
    return true
  })

  useEffect(() => {
    if (visibleContent.length === 0) {
      return
    }
    if (!selectedContentId || !visibleContent.some((entry) => entry.id === selectedContentId)) {
      onSelectContent(visibleContent[0].id)
    }
  }, [visibleContent, selectedContentId, onSelectContent])

  const selectedEntry = visibleContent.find((entry) => entry.id === selectedContentId)
  const selectedOutreach = selectedEntry?.outreachId ? outreachById.get(selectedEntry.outreachId) : undefined
  const visibleFeedback = feedback.filter((entry) => (selectedAudienceId ? entry.audienceId === selectedAudienceId : true))
  const selectedEntryFeedback = selectedEntry ? visibleFeedback.filter((entry) => entry.contentId === selectedEntry.id) : []
  const createContentDraft = () => {
    const matchedOutreach = outreach.find((entry) => {
      if (selectedAudienceId && entry.audienceId !== selectedAudienceId) return false
      if (selectedCategory && entry.channel !== selectedCategory) return false
      return true
    })

    const newId = onCreateContent({
      audienceId: selectedAudienceId,
      outreachId: matchedOutreach?.id ?? '',
      platform: matchedOutreach?.channel ?? selectedCategory ?? 'reddit'
    })
    onSelectContent(newId)
  }

  useEffect(() => {
    setTitleDraft(selectedEntry?.title ?? '')
    setBodyDraft(selectedEntry?.body ?? '')
    setDocLinkDraft(selectedEntry?.docLink ?? '')
    setPostedChannelDraft(selectedEntry?.postedChannel ?? '')
    setPostUrlDraft(selectedEntry?.postUrl ?? '')
  }, [
    selectedEntry?.id,
    selectedEntry?.title,
    selectedEntry?.body,
    selectedEntry?.docLink,
    selectedEntry?.postedChannel,
    selectedEntry?.postUrl
  ])

  return (
    <section className="content-panel">
      <div className="projection-header">
        <div>
          <p className="eyebrow">Arbetsyta</p>
          <h2>Utkast</h2>
        </div>
        <div className="toolbar">
          <button type="button" className="primary-button" onClick={createContentDraft}>
            Nytt utkast
          </button>
          <button
            type="button"
            className={activeTab === 'drafts' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('drafts')}
          >
            Utkast
          </button>
          <button
            type="button"
            className={activeTab === 'feedback' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('feedback')}
          >
            Feedback
          </button>
          <p className="projection-summary">{activeTab === 'drafts' ? `${visibleContent.length} utkast` : `${visibleFeedback.length} svar`}</p>
        </div>
      </div>

      <div className="toolbar">
        <select className="audience-filter" value={selectedAudienceId} onChange={(event) => setSelectedAudienceId(event.target.value)}>
          <option value="">Alla målgrupper</option>
          {audiences.map((audience) => (
            <option key={audience.id} value={audience.id}>
              {audience.name}
            </option>
          ))}
        </select>
        <select className="audience-filter" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
          <option value="">Alla kategorier</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'drafts' ? (
        <div className="content-grid">
        <div className="projection-card">
          <h3>Lista</h3>
          <div className="content-list">
            {visibleContent.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`content-list-item ${selectedContentId === entry.id ? 'content-list-item-selected' : ''}`}
                onClick={() => onSelectContent(entry.id)}
              >
                <strong>{entry.title}</strong>
                <div className="content-list-item-meta">
                  <span>{entry.platform}</span>
                  <span>{entry.status}</span>
                  {entry.sentAt ? (
                    <span>
                      {new Intl.DateTimeFormat('sv-SE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(new Date(entry.sentAt))}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
            {visibleContent.length === 0 ? <p className="projection-summary">Inga utkast ännu.</p> : null}
          </div>
        </div>

        <div className="projection-card content-card">
          {selectedEntry ? (
            <>
              <div className="content-card-meta">
                <span className="node-badge">{selectedEntry.platform}</span>
                <span className="node-badge node-badge-muted">{selectedEntry.status}</span>
                {selectedOutreach?.channel ? <span className="node-badge">{selectedOutreach.channel}</span> : null}
              </div>
              <h3>{selectedEntry.title}</h3>
              {selectedOutreach ? (
                <p className="projection-summary">Spår: {selectedOutreach.community}</p>
              ) : null}
              {selectedEntry.sentAt ? (
                <p className="projection-summary">
                  Skickat:{' '}
                  {new Intl.DateTimeFormat('sv-SE', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).format(new Date(selectedEntry.sentAt))}
                </p>
              ) : null}
              <div className="toolbar">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    onSetContentStatus(selectedEntry.id, selectedEntry.status === 'sent' ? 'draft' : 'sent')
                  }
                >
                  {selectedEntry.status === 'sent' ? 'Tillbaka till utkast' : 'Markera som skickat'}
                </button>
                <button type="button" className="secondary-button" onClick={() => onDuplicateContent(selectedEntry.id)}>
                  Duplicera
                </button>
                <select
                  className="audience-filter"
                  value={selectedEntry.status}
                  onChange={(event) => onSetContentStatus(selectedEntry.id, event.target.value)}
                >
                  <option value="draft">Utkast</option>
                  <option value="ready">Redo</option>
                  <option value="sent">Skickat</option>
                  <option value="replied">Svarat</option>
                  <option value="no_response">Ingen respons</option>
                  <option value="follow_up">Följ upp</option>
                </select>
              </div>
              <div className="field-stack">
                <label>
                  Titel
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => onUpdateContentFields(selectedEntry.id, { title: titleDraft })}
                    placeholder="Rubrik för utkastet"
                  />
                </label>
                <label>
                  Text
                  <textarea
                    rows={12}
                    value={bodyDraft}
                    onChange={(event) => setBodyDraft(event.target.value)}
                    onBlur={() => onUpdateContentFields(selectedEntry.id, { body: bodyDraft })}
                    placeholder="Skriv eller justera inlägget här..."
                  />
                </label>
                <label>
                  Länk till tjänst eller dokument
                  <input
                    value={docLinkDraft}
                    onChange={(event) => setDocLinkDraft(event.target.value)}
                    onBlur={() => onUpdateContentFields(selectedEntry.id, { docLink: docLinkDraft })}
                    placeholder="https://parkpal.se/sv"
                  />
                </label>
                <label>
                  Skickad i kanal
                  <input
                    value={postedChannelDraft}
                    onChange={(event) => setPostedChannelDraft(event.target.value)}
                    onBlur={() => onUpdateContentFields(selectedEntry.id, { postedChannel: postedChannelDraft })}
                    placeholder="t.ex. r/elbilsverige"
                  />
                </label>
                <label>
                  Länk till post
                  <input
                    value={postUrlDraft}
                    onChange={(event) => setPostUrlDraft(event.target.value)}
                    onBlur={() => onUpdateContentFields(selectedEntry.id, { postUrl: postUrlDraft })}
                    placeholder="https://reddit.com/..."
                  />
                </label>
              </div>
              {selectedEntry.docLink ? (
                <a href={selectedEntry.docLink} target="_blank" rel="noreferrer">
                  {selectedEntry.docLink}
                </a>
              ) : null}
            </>
          ) : (
            <p className="projection-summary">Välj ett utkast i listan.</p>
          )}
        </div>
        </div>
      ) : (
        <div className="content-grid">
          <div className="projection-card">
            <h3>Svar</h3>
            <div className="content-list">
              {visibleFeedback.map((entry) => (
                <article key={entry.id} className="content-list-item feedback-list-item">
                  <strong>{entry.source || 'Feedback'}</strong>
                  <span>{entry.summary}</span>
                </article>
              ))}
              {visibleFeedback.length === 0 ? <p className="projection-summary">Ingen feedback ännu.</p> : null}
            </div>
          </div>
          <div className="projection-card content-card">
            {selectedEntry ? (
              <>
                <h3>Lägg till feedback</h3>
                <p className="projection-summary">Kopplat till: {selectedEntry.title}</p>
                {selectedEntryFeedback.length > 0 ? (
                  <div className="feedback-history">
                    {selectedEntryFeedback.map((entry) => (
                      <article key={entry.id} className="feedback-history-item">
                        <strong>{entry.source || 'Feedback'}</strong>
                        <p>{entry.summary}</p>
                        {entry.nextStep ? <span>Nästa steg: {entry.nextStep}</span> : null}
                      </article>
                    ))}
                  </div>
                ) : null}
                <textarea
                  className="content-feedback-input"
                  rows={6}
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  placeholder="Skriv vad du fick för svar eller feedback..."
                />
                <textarea
                  className="content-feedback-input"
                  rows={3}
                  value={nextStepDraft}
                  onChange={(event) => setNextStepDraft(event.target.value)}
                  placeholder="Nästa steg, t.ex. svara, följa upp eller ändra texten..."
                />
                <div className="toolbar">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      if (!feedbackDraft.trim()) return
                      onAddFeedback(selectedEntry.id, feedbackDraft.trim(), nextStepDraft.trim())
                      setFeedbackDraft('')
                      setNextStepDraft('')
                    }}
                  >
                    Spara feedback
                  </button>
                </div>
              </>
            ) : (
              <p className="projection-summary">Välj först ett utkast under fliken Utkast.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default ContentPanel
