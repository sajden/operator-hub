import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const localDir = path.resolve(repoRoot, '.local')
const dbPath = path.resolve(localDir, 'planner.db')

let database

function nowIso() {
  return new Date().toISOString()
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeekKey() {
  const date = new Date()
  const utcDay = date.getUTCDay()
  const offset = utcDay === 0 ? -6 : 1 - utcDay
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function parseJson(value, fallback = null) {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function columnExists(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function ensureColumn(db, tableName, columnDefinition) {
  const [columnName] = columnDefinition.trim().split(/\s+/, 1)
  if (!columnExists(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
  }
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function nextOccurrenceDate(rule, fromDate) {
  const anchor = new Date(`${fromDate}T09:00:00.000Z`)
  if (Number.isNaN(anchor.getTime())) return null

  if (rule === 'daily') {
    anchor.setUTCDate(anchor.getUTCDate() + 1)
    return anchor.toISOString().slice(0, 10)
  }

  if (rule === 'weekdays') {
    do {
      anchor.setUTCDate(anchor.getUTCDate() + 1)
    } while ([0, 6].includes(anchor.getUTCDay()))
    return anchor.toISOString().slice(0, 10)
  }

  if (rule === 'weekly') {
    anchor.setUTCDate(anchor.getUTCDate() + 7)
    return anchor.toISOString().slice(0, 10)
  }

  return null
}

function resolveMicrosoftRecurrenceRule(recurrence) {
  const pattern = recurrence?.pattern ?? recurrence ?? null
  const type = String(pattern?.type ?? '').toLowerCase()

  if (!type) return 'none'
  if (type.includes('daily')) return 'daily'
  if (type.includes('weekday')) return 'weekdays'
  if (type.includes('weekly') || type.includes('relativeweekly')) return 'weekly'

  return 'weekly'
}

function initSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS planner_boards (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      board_type TEXT NOT NULL,
      description TEXT,
      linked_domain TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      column_kind TEXT NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY(board_id) REFERENCES planner_boards(id)
    );

    CREATE TABLE IF NOT EXISTS planner_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      horizon TEXT NOT NULL,
      status TEXT NOT NULL,
      target_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_work_items (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL,
      focus_date TEXT,
      due_date TEXT,
      importance TEXT NOT NULL,
      friction_type TEXT NOT NULL,
      recurrence_rule TEXT NOT NULL DEFAULT 'none',
      recurrence_source TEXT NOT NULL DEFAULT 'manual',
      series_id TEXT,
      series_name TEXT,
      calendar_event_id TEXT,
      sync_mode TEXT NOT NULL DEFAULT 'none',
      sync_provider TEXT,
      external_calendar_id TEXT,
      external_event_id TEXT,
      last_synced_at TEXT,
      scheduled_start_at TEXT,
      scheduled_end_at TEXT,
      execution_note TEXT,
      goal_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(board_id) REFERENCES planner_boards(id),
      FOREIGN KEY(column_id) REFERENCES planner_columns(id),
      FOREIGN KEY(goal_id) REFERENCES planner_goals(id)
    );

    CREATE TABLE IF NOT EXISTS planner_views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      view_mode TEXT NOT NULL,
      theme_preference TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_widgets (
      id TEXT PRIMARY KEY,
      view_id TEXT NOT NULL,
      widget_type TEXT NOT NULL,
      title TEXT NOT NULL,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      config_json TEXT,
      is_visible INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(view_id) REFERENCES planner_views(id)
    );

    CREATE TABLE IF NOT EXISTS planner_actions (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      capability_key TEXT NOT NULL,
      scope TEXT NOT NULL,
      display_label TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS planner_action_runs (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      status TEXT NOT NULL,
      result_summary TEXT,
      error_message TEXT,
      artifacts_json TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY(action_id) REFERENCES planner_actions(id)
    );

    CREATE TABLE IF NOT EXISTS planner_events (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      occurred_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_sync_suppressions (
      external_event_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `)

  ensureColumn(db, 'planner_work_items', "recurrence_rule TEXT NOT NULL DEFAULT 'none'")
  ensureColumn(db, 'planner_work_items', "recurrence_source TEXT NOT NULL DEFAULT 'manual'")
  ensureColumn(db, 'planner_work_items', 'series_id TEXT')
  ensureColumn(db, 'planner_work_items', 'series_name TEXT')
  ensureColumn(db, 'planner_work_items', 'calendar_event_id TEXT')
  ensureColumn(db, 'planner_work_items', "sync_mode TEXT NOT NULL DEFAULT 'none'")
  ensureColumn(db, 'planner_work_items', 'sync_provider TEXT')
  ensureColumn(db, 'planner_work_items', 'external_calendar_id TEXT')
  ensureColumn(db, 'planner_work_items', 'external_event_id TEXT')
  ensureColumn(db, 'planner_work_items', 'last_synced_at TEXT')
  ensureColumn(db, 'planner_work_items', 'scheduled_start_at TEXT')
  ensureColumn(db, 'planner_work_items', 'scheduled_end_at TEXT')
  ensureColumn(db, 'planner_work_items', 'execution_note TEXT')
}

function rowCount(db, table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
}

function isSuppressedExternalEvent(externalEventId) {
  if (!externalEventId) return false
  const db = getDb()
  const row = db
    .prepare('SELECT external_event_id FROM planner_sync_suppressions WHERE external_event_id = ? LIMIT 1')
    .get(externalEventId)
  return Boolean(row)
}

function suppressExternalEvent(externalEventId, provider = 'microsoft', reason = 'deleted_in_planner') {
  if (!externalEventId) return
  const db = getDb()
  db.prepare(`
    INSERT INTO planner_sync_suppressions (external_event_id, provider, reason, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(external_event_id) DO UPDATE SET
      provider = excluded.provider,
      reason = excluded.reason,
      created_at = excluded.created_at
  `).run(externalEventId, provider, reason, nowIso())
}

function seedDefaults(db) {
  if (rowCount(db, 'planner_boards') > 0) return

  const now = nowIso()
  const today = todayKey()
  const weekStart = startOfWeekKey()

  const insertBoard = db.prepare(`
    INSERT INTO planner_boards (id, slug, name, board_type, description, linked_domain, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertColumn = db.prepare(`
    INSERT INTO planner_columns (id, board_id, name, column_kind, position)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertGoal = db.prepare(`
    INSERT INTO planner_goals (id, name, description, horizon, status, target_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertWorkItem = db.prepare(`
    INSERT INTO planner_work_items (
      id, board_id, column_id, title, details, status, focus_date, due_date, importance,
      friction_type, recurrence_rule, recurrence_source, series_id, series_name, calendar_event_id,
      sync_mode, sync_provider, external_calendar_id, external_event_id, last_synced_at,
      scheduled_start_at, scheduled_end_at, execution_note,
      goal_id, created_at, updated_at, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertView = db.prepare(`
    INSERT INTO planner_views (id, name, view_mode, theme_preference, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertWidget = db.prepare(`
    INSERT INTO planner_widgets (
      id, view_id, widget_type, title, position_x, position_y, width, height, config_json, is_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertAction = db.prepare(`
    INSERT INTO planner_actions (id, action_type, capability_key, scope, display_label, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertEvent = db.prepare(`
    INSERT INTO planner_events (id, entity_type, entity_id, event_type, payload_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  insertBoard.run(
    'board-daily',
    'daily',
    'Daily Execution',
    'daily',
    'Run the day from one focused board.',
    'planner',
    now,
    now
  )
  insertBoard.run(
    'board-parkpal',
    'parkpal-outreach',
    'Parkpal Outreach',
    'outreach',
    'Specialized board for Parkpal channels, outreach, and follow-up work.',
    'parkpal',
    now,
    now
  )

  const dailyColumns = [
    ['col-daily-inbox', 'Inbox', 'inbox', 0],
    ['col-daily-today', 'Today', 'today', 1],
    ['col-daily-progress', 'In Progress', 'in_progress', 2],
    ['col-daily-done', 'Done', 'done', 3]
  ]

  const parkpalColumns = [
    ['col-parkpal-ideas', 'Ideas', 'planned', 0],
    ['col-parkpal-today', 'Today', 'today', 1],
    ['col-parkpal-progress', 'In Progress', 'in_progress', 2],
    ['col-parkpal-done', 'Done', 'done', 3]
  ]

  for (const [id, name, kind, position] of dailyColumns) {
    insertColumn.run(id, 'board-daily', name, kind, position)
  }

  for (const [id, name, kind, position] of parkpalColumns) {
    insertColumn.run(id, 'board-parkpal', name, kind, position)
  }

  insertGoal.run(
    'goal-clarify-offer',
    'Clarify your offer',
    'Define what service packages or outcomes the business should actually sell next.',
    'month',
    'active',
    null,
    now,
    now
  )
  insertGoal.run(
    'goal-outreach-rhythm',
    'Build an outreach rhythm',
    'Reduce friction around contacting people and following up every week.',
    'week',
    'active',
    weekStart,
    now,
    now
  )

  insertWorkItem.run(
    'work-patrik-mail',
    'board-daily',
    'col-daily-today',
    'Skicka mail till Patrik',
    'Follow up on the previous conversation and suggest a concrete next step.',
    'planned',
    today,
    today,
    'high',
    'follow_up',
    'none',
    'manual',
    null,
    null,
    null,
    'none',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'goal-outreach-rhythm',
    now,
    now,
    null,
    null
  )
  insertWorkItem.run(
    'work-offer-outline',
    'board-daily',
    'col-daily-progress',
    'Skissa erbjudande för AI/automation',
    'Write a first outline of the offer and what the customer would actually buy.',
    'in_progress',
    today,
    null,
    'critical',
    'avoidance',
    'none',
    'manual',
    null,
    null,
    null,
    'none',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'goal-clarify-offer',
    now,
    now,
    now,
    null
  )
  insertWorkItem.run(
    'work-carryover-channels',
    'board-parkpal',
    'col-parkpal-ideas',
    'Gå igenom vilka kanaler Parkpal ska testa',
    'List likely channels and note which ones should be tested first.',
    'planned',
    '2026-03-16',
    null,
    'high',
    'admin',
    'none',
    'manual',
    null,
    null,
    null,
    'none',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'goal-clarify-offer',
    now,
    now,
    null,
    null
  )
  insertWorkItem.run(
    'work-rehab',
    'board-daily',
    'col-daily-inbox',
    'Rehab',
    'Planned recurring rehab block. Should become part of the daily flow and keep history over time.',
    'planned',
    today,
    today,
    'high',
    'admin',
    'weekdays',
    'manual',
    'series-rehab',
    'Rehab',
    null,
    'none',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    now,
    now,
    null,
    null
  )
  insertWorkItem.run(
    'work-promenad',
    'board-daily',
    'col-daily-inbox',
    'Promenad',
    'Recurring walk that should be easy to complete or move without losing history.',
    'planned',
    today,
    today,
    'normal',
    'neutral',
    'daily',
    'manual',
    'series-promenad',
    'Promenad',
    null,
    'none',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    now,
    now,
    null,
    null
  )

  insertView.run('dashboard-main', 'Main Dashboard', 'desktop', 'light', now, now)
  insertView.run('dashboard-tv', 'TV Wallboard', 'tv', 'light', now, now)

  const desktopWidgets = [
    ['widget-today', 'today', 'Today Focus', 0, 0, 7, 8, null],
    ['widget-followups', 'follow_ups', 'Follow-ups', 7, 0, 5, 4, null],
    ['widget-goals', 'goals', 'Current Direction', 7, 4, 5, 4, null],
    ['widget-progress', 'in_progress', 'In Motion', 0, 8, 7, 4, null],
    ['widget-weekly', 'weekly_progress', 'Momentum', 7, 8, 5, 4, null],
    ['widget-actions', 'quick_actions', 'Quick Actions', 0, 12, 12, 2, null]
  ]

  const tvWidgets = [
    ['widget-tv-today', 'today', 'Today', 0, 0, 8, 6, JSON.stringify({ limit: 4 })],
    ['widget-tv-progress', 'in_progress', 'In Progress', 8, 0, 4, 6, JSON.stringify({ limit: 3 })],
    ['widget-tv-weekly', 'weekly_progress', 'Weekly Progress', 0, 6, 6, 3, null],
    ['widget-tv-goals', 'goals', 'Current Goals', 6, 6, 6, 3, JSON.stringify({ limit: 2 })]
  ]

  for (const [id, type, title, x, y, width, height, config] of desktopWidgets) {
    insertWidget.run(id, 'dashboard-main', type, title, x, y, width, height, config, 1)
  }

  for (const [id, type, title, x, y, width, height, config] of tvWidgets) {
    insertWidget.run(id, 'dashboard-tv', type, title, x, y, width, height, config, 1)
  }

  insertAction.run('action-open-tv', 'open_tv_view', 'display.open', 'dashboard', 'Open TV view', 1)
  insertAction.run('action-draft-follow-up', 'draft_message', 'message.draft', 'work_item', 'Draft follow-up', 1)
  insertAction.run('action-summarize-work', 'summarize_context', 'context.summarize', 'work_item', 'Summarize context', 1)

  insertEvent.run('event-seed-1', 'work_item', 'work-patrik-mail', 'focused_for_day', JSON.stringify({ focusDate: today }), now)
  insertEvent.run('event-seed-2', 'work_item', 'work-offer-outline', 'started', JSON.stringify({ startedAt: now }), now)
}

function ensureRuntimeDefaults(db) {
  const upsertWidget = db.prepare(`
    INSERT INTO planner_widgets (
      id, view_id, widget_type, title, position_x, position_y, width, height, config_json, is_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      view_id = excluded.view_id,
      widget_type = excluded.widget_type,
      title = excluded.title,
      position_x = excluded.position_x,
      position_y = excluded.position_y,
      width = excluded.width,
      height = excluded.height,
      config_json = excluded.config_json,
      is_visible = excluded.is_visible
  `)

  const upsertAction = db.prepare(`
    INSERT INTO planner_actions (id, action_type, capability_key, scope, display_label, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      action_type = excluded.action_type,
      capability_key = excluded.capability_key,
      scope = excluded.scope,
      display_label = excluded.display_label,
      is_enabled = excluded.is_enabled
  `)

  const desktopWidgets = [
    ['widget-today', 'dashboard-main', 'today', 'Today Focus', 0, 0, 7, 8, null],
    ['widget-followups', 'dashboard-main', 'follow_ups', 'Follow-ups', 7, 0, 5, 4, null],
    ['widget-goals', 'dashboard-main', 'goals', 'Current Direction', 7, 4, 5, 4, null],
    ['widget-progress', 'dashboard-main', 'in_progress', 'In Motion', 0, 8, 7, 4, null],
    ['widget-weekly', 'dashboard-main', 'weekly_progress', 'Momentum', 7, 8, 5, 4, null],
    ['widget-actions', 'dashboard-main', 'quick_actions', 'Quick Actions', 0, 12, 12, 2, null]
  ]

  const tvWidgets = [
    ['widget-tv-today', 'dashboard-tv', 'today', 'Today', 0, 0, 8, 6, JSON.stringify({ limit: 4 })],
    ['widget-tv-progress', 'dashboard-tv', 'in_progress', 'In Progress', 8, 0, 4, 6, JSON.stringify({ limit: 3 })],
    ['widget-tv-weekly', 'dashboard-tv', 'weekly_progress', 'Weekly Progress', 0, 6, 6, 3, null],
    ['widget-tv-goals', 'dashboard-tv', 'goals', 'Current Goals', 6, 6, 6, 3, JSON.stringify({ limit: 2 })]
  ]

  for (const widget of [...desktopWidgets, ...tvWidgets]) {
    upsertWidget.run(...widget, 1)
  }

  upsertAction.run('action-open-tv', 'open_tv_view', 'display.open', 'dashboard', 'Open TV view', 1)
  upsertAction.run('action-draft-follow-up', 'draft_message', 'message.draft', 'work_item', 'Draft follow-up', 1)
  upsertAction.run('action-summarize-work', 'summarize_context', 'context.summarize', 'work_item', 'Summarize context', 1)
}

function normalizeLegacyCalendarSeriesTitles(db) {
  db.exec(`
    UPDATE planner_work_items
    SET title = substr(title, 1, length(title) - 10)
    WHERE recurrence_source = 'calendar'
      AND external_event_id LIKE 'series-summary:%'
      AND title LIKE '% recurring'
  `)
}

function getDb() {
  if (database) return database

  mkdirSync(localDir, { recursive: true })
  database = new DatabaseSync(dbPath, { timeout: 5000 })
  initSchema(database)
  seedDefaults(database)
  ensureRuntimeDefaults(database)
  normalizeLegacyCalendarSeriesTitles(database)
  return database
}

function mapBoard(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    boardType: row.board_type,
    description: row.description ?? '',
    linkedDomain: row.linked_domain,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapColumn(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    columnKind: row.column_kind,
    position: row.position
  }
}

function mapGoal(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    horizon: row.horizon,
    status: row.status,
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapWorkItem(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    details: row.details ?? '',
    status: row.status,
    focusDate: row.focus_date,
    dueDate: row.due_date,
    importance: row.importance,
    frictionType: row.friction_type,
    recurrenceRule: row.recurrence_rule ?? 'none',
    recurrenceSource: row.recurrence_source ?? 'manual',
    seriesId: row.series_id ?? null,
    seriesName: row.series_name ?? null,
    calendarEventId: row.calendar_event_id ?? null,
    syncMode: row.sync_mode ?? 'none',
    syncProvider: row.sync_provider ?? null,
    externalCalendarId: row.external_calendar_id ?? null,
    externalEventId: row.external_event_id ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
    scheduledStartAt: row.scheduled_start_at ?? null,
    scheduledEndAt: row.scheduled_end_at ?? null,
    executionNote: row.execution_note ?? '',
    goalId: row.goal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at
  }
}

function mapView(row) {
  return {
    id: row.id,
    name: row.name,
    viewMode: row.view_mode,
    themePreference: row.theme_preference,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapWidget(row) {
  return {
    id: row.id,
    viewId: row.view_id,
    widgetType: row.widget_type,
    title: row.title,
    layout: {
      x: row.position_x,
      y: row.position_y,
      w: row.width,
      h: row.height
    },
    config: parseJson(row.config_json, {}),
    isVisible: Boolean(row.is_visible)
  }
}

function mapAction(row) {
  return {
    id: row.id,
    actionType: row.action_type,
    capabilityKey: row.capability_key,
    scope: row.scope,
    displayLabel: row.display_label,
    enabled: Boolean(row.is_enabled)
  }
}

export function listPlannerBoards() {
  const db = getDb()
  return db
    .prepare('SELECT * FROM planner_boards ORDER BY CASE WHEN slug = ? THEN 0 ELSE 1 END, name ASC')
    .all('daily')
    .map(mapBoard)
}

export function createPlannerBoard(input) {
  const db = getDb()
  const now = nowIso()
  const baseSlug = slugify(input.name)
  if (!baseSlug) {
    throw new Error('Board name is required')
  }

  let slug = baseSlug
  let suffix = 1
  while (getPlannerBoard(slug)) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const boardId = generateId('board')
  const boardType = input.boardType ?? 'specialized'
  const description = input.description ?? 'Custom board'

  db.prepare(`
    INSERT INTO planner_boards (id, slug, name, board_type, description, linked_domain, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(boardId, slug, input.name, boardType, description, 'planner', now, now)

  const columns = [
    ['Inbox', 'inbox', 0],
    ['Today', 'today', 1],
    ['In Progress', 'in_progress', 2],
    ['Done', 'done', 3]
  ]

  for (const [name, kind, position] of columns) {
    db.prepare(`
      INSERT INTO planner_columns (id, board_id, name, column_kind, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId('col'), boardId, name, kind, position)
  }

  db.prepare(`
    INSERT INTO planner_events (id, entity_type, entity_id, event_type, payload_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(generateId('event'), 'board', boardId, 'created', JSON.stringify({ slug, boardType }), now)

  return getPlannerBoard(boardId)
}

export function getPlannerBoard(identifier) {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM planner_boards WHERE id = ? OR slug = ? LIMIT 1')
    .get(identifier, identifier)

  return row ? mapBoard(row) : null
}

export function listBoardColumns(boardId) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM planner_columns WHERE board_id = ? ORDER BY position ASC')
    .all(boardId)
    .map(mapColumn)
}

export function listBoardWorkItems(boardId) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM planner_work_items WHERE board_id = ? ORDER BY created_at ASC')
    .all(boardId)
    .map(mapWorkItem)
}

export function listGoals() {
  const db = getDb()
  return db
    .prepare('SELECT * FROM planner_goals WHERE status = ? ORDER BY created_at ASC')
    .all('active')
    .map(mapGoal)
}

export function getDashboardView(mode = 'desktop') {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM planner_views WHERE view_mode = ? LIMIT 1')
    .get(mode)
  return row ? mapView(row) : null
}

export function listViewWidgets(viewId) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM planner_widgets WHERE view_id = ? AND is_visible = 1 ORDER BY position_y ASC, position_x ASC')
    .all(viewId)
    .map(mapWidget)
}

export function listPlannerActions(scope) {
  const db = getDb()
  const statement = scope
    ? db.prepare('SELECT * FROM planner_actions WHERE scope = ? AND is_enabled = 1 ORDER BY display_label ASC')
    : db.prepare('SELECT * FROM planner_actions WHERE is_enabled = 1 ORDER BY scope ASC, display_label ASC')
  const rows = scope ? statement.all(scope) : statement.all()
  return rows.map(mapAction)
}

export function getPlannerAction(actionId) {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM planner_actions WHERE id = ? LIMIT 1')
    .get(actionId)
  return row ? mapAction(row) : null
}

export function getPlannerWorkItem(workItemId) {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM planner_work_items WHERE id = ? LIMIT 1')
    .get(workItemId)
  return row ? mapWorkItem(row) : null
}

export function listPlannerSeriesWorkItems(seriesId, limit = 20) {
  const db = getDb()
  return db
    .prepare(`
      SELECT * FROM planner_work_items
      WHERE series_id = ?
      ORDER BY COALESCE(focus_date, due_date, created_at) DESC, created_at DESC
      LIMIT ?
    `)
    .all(seriesId, limit)
    .map(mapWorkItem)
}

export function listPlannerEntityEvents(entityType, entityId, limit = 20) {
  const db = getDb()
  return db
    .prepare(`
      SELECT * FROM planner_events
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `)
    .all(entityType, entityId, limit)
    .map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventType: row.event_type,
      payload: parseJson(row.payload_json, {}),
      occurredAt: row.occurred_at
    }))
}

export function getPlannerSeriesSnapshot(seriesId) {
  const occurrences = listPlannerSeriesWorkItems(seriesId, 24)
  if (occurrences.length === 0) {
    return null
  }

  const recentEvents = listPlannerEntityEvents('series', seriesId, 12)
  const completedCount = occurrences.filter((item) => item.status === 'done').length
  const inProgressCount = occurrences.filter((item) => item.status === 'in_progress').length
  const plannedCount = occurrences.filter((item) => item.status === 'planned').length
  const lastCompleted = occurrences.find((item) => item.completedAt)

  return {
    seriesId,
    name: occurrences[0].seriesName ?? occurrences[0].title,
    recurrenceRule: occurrences[0].recurrenceRule,
    recurrenceSource: occurrences[0].recurrenceSource,
    syncProvider: occurrences[0].syncProvider,
    stats: {
      totalOccurrences: occurrences.length,
      completedCount,
      inProgressCount,
      plannedCount,
      lastCompletedAt: lastCompleted?.completedAt ?? null
    },
    occurrences,
    recentEvents
  }
}

export function getPlannerWorkItemByExternalEventId(externalEventId) {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM planner_work_items WHERE external_event_id = ? LIMIT 1')
    .get(externalEventId)
  return row ? mapWorkItem(row) : null
}

export function deletePlannerWorkItem(workItemId) {
  const db = getDb()
  const existing = getPlannerWorkItem(workItemId)
  if (!existing) return false

  if (existing.syncProvider === 'microsoft' && existing.externalEventId) {
    suppressExternalEvent(existing.externalEventId, 'microsoft', 'deleted_in_planner')
  }

  db.prepare('DELETE FROM planner_work_items WHERE id = ?').run(workItemId)
  db.prepare('DELETE FROM planner_events WHERE entity_type = ? AND entity_id = ?').run('work_item', workItemId)
  return true
}

export function cleanupPlannerCalendarImports(options = {}) {
  const boardId = options.boardId ?? 'board-daily'
  const board = getPlannerBoard(boardId)
  if (!board) {
    throw new Error(`Unknown board: ${boardId}`)
  }

  const db = getDb()
  const today = todayKey()
  const removedIds = new Set()
  const reasons = {
    futureRecurringOccurrences: 0,
    placeholderTestImports: 0,
    duplicateExternalEvents: 0,
    duplicateSeriesSummaries: 0
  }

  const futureRecurringRows = db
    .prepare(
      `
        SELECT id
        FROM planner_work_items
        WHERE board_id = ?
          AND sync_provider = 'microsoft'
          AND recurrence_source = 'calendar'
          AND series_id IS NOT NULL
          AND external_event_id NOT LIKE 'series-summary:%'
          AND focus_date IS NOT NULL
          AND focus_date > ?
      `
    )
    .all(board.id, today)

  for (const row of futureRecurringRows) {
    if (removedIds.has(row.id)) continue
    if (deletePlannerWorkItem(row.id)) {
      removedIds.add(row.id)
      reasons.futureRecurringOccurrences += 1
    }
  }

  const placeholderRows = db
    .prepare(
      `
        SELECT id
        FROM planner_work_items
        WHERE board_id = ?
          AND sync_provider = 'microsoft'
          AND (
            external_event_id LIKE 'mock-%'
            OR external_event_id LIKE 'ev-%'
            OR external_event_id LIKE 'series-summary:series-%'
            OR calendar_event_id LIKE 'mock-%'
            OR calendar_event_id LIKE 'series-%'
          )
      `
    )
    .all(board.id)

  for (const row of placeholderRows) {
    if (removedIds.has(row.id)) continue
    if (deletePlannerWorkItem(row.id)) {
      removedIds.add(row.id)
      reasons.placeholderTestImports += 1
    }
  }

  const duplicateExternalEventGroups = db
    .prepare(
      `
        SELECT external_event_id AS externalEventId, GROUP_CONCAT(id) AS ids
        FROM planner_work_items
        WHERE board_id = ?
          AND sync_provider = 'microsoft'
          AND external_event_id IS NOT NULL
          AND external_event_id != ''
        GROUP BY external_event_id
        HAVING COUNT(*) > 1
      `
    )
    .all(board.id)

  for (const group of duplicateExternalEventGroups) {
    const items = String(group.ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => getPlannerWorkItem(id))
      .filter(Boolean)
      .sort((left, right) => {
        const leftStamp = new Date(left.lastSyncedAt ?? left.updatedAt ?? left.createdAt ?? 0).getTime()
        const rightStamp = new Date(right.lastSyncedAt ?? right.updatedAt ?? right.createdAt ?? 0).getTime()
        return rightStamp - leftStamp
      })

    const keep = items[0]
    for (const item of items.slice(1)) {
      if (!item || item.id === keep?.id || removedIds.has(item.id)) continue
      if (deletePlannerWorkItem(item.id)) {
        removedIds.add(item.id)
        if (String(item.externalEventId ?? '').startsWith('series-summary:')) {
          reasons.duplicateSeriesSummaries += 1
        } else {
          reasons.duplicateExternalEvents += 1
        }
      }
    }
  }

  return {
    boardId: board.id,
    removedCount: removedIds.size,
    removedIds: Array.from(removedIds),
    reasons
  }
}

export function createPlannerWorkItem(input) {
  const db = getDb()
  const now = nowIso()
  const board = getPlannerBoard(input.boardId)
  if (!board) throw new Error(`Unknown board: ${input.boardId}`)

  const columns = listBoardColumns(board.id)
  const fallbackColumn = columns.find((column) => column.columnKind === 'inbox') ?? columns[0]
  const columnId = input.columnId ?? fallbackColumn?.id
  if (!columnId) throw new Error(`Board ${board.id} does not have any columns`)

  const workItemId = input.id ?? `work-${Math.random().toString(36).slice(2, 10)}`
  db.prepare(`
    INSERT INTO planner_work_items (
      id, board_id, column_id, title, details, status, focus_date, due_date, importance,
      friction_type, recurrence_rule, recurrence_source, series_id, series_name, calendar_event_id,
      sync_mode, sync_provider, external_calendar_id, external_event_id, last_synced_at,
      scheduled_start_at, scheduled_end_at, execution_note,
      goal_id, created_at, updated_at, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workItemId,
    board.id,
    columnId,
    input.title,
    input.details ?? '',
    input.status ?? 'planned',
    input.focusDate ?? null,
    input.dueDate ?? null,
    input.importance ?? 'normal',
    input.frictionType ?? 'neutral',
    input.recurrenceRule ?? 'none',
    input.recurrenceSource ?? 'manual',
    input.seriesId ?? (input.recurrenceRule && input.recurrenceRule !== 'none' ? generateId('series') : null),
    input.seriesName ?? (input.recurrenceRule && input.recurrenceRule !== 'none' ? input.title : null),
    input.calendarEventId ?? null,
    input.syncMode ?? 'none',
    input.syncProvider ?? null,
    input.externalCalendarId ?? null,
    input.externalEventId ?? null,
    input.lastSyncedAt ?? null,
    input.scheduledStartAt ?? null,
    input.scheduledEndAt ?? null,
    input.executionNote ?? '',
    input.goalId ?? null,
    now,
    now,
    null,
    null
  )

  db.prepare(`
    INSERT INTO planner_events (id, entity_type, entity_id, event_type, payload_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `event-${Math.random().toString(36).slice(2, 10)}`,
    'work_item',
    workItemId,
    'created',
    JSON.stringify({ boardId: board.id, columnId }),
    now
  )

  return getPlannerWorkItem(workItemId)
}

export function updatePlannerWorkItem(workItemId, patch) {
  const db = getDb()
  const existing = getPlannerWorkItem(workItemId)
  if (!existing) throw new Error(`Unknown work item: ${workItemId}`)

  const hasPlannerSchedulingOverride =
    existing.syncProvider === 'microsoft' &&
    (
      'focusDate' in patch ||
      'dueDate' in patch ||
      'scheduledStartAt' in patch ||
      'scheduledEndAt' in patch ||
      'columnId' in patch
    )

  const next = {
    ...existing,
    ...patch,
    syncMode: hasPlannerSchedulingOverride
      ? existing.syncMode === 'planner_to_calendar'
        ? 'planner_to_calendar'
        : 'bidirectional'
      : patch.syncMode ?? existing.syncMode,
    updatedAt: nowIso()
  }

  db.prepare(`
    UPDATE planner_work_items
    SET title = ?, details = ?, status = ?, focus_date = ?, due_date = ?, importance = ?,
        friction_type = ?, recurrence_rule = ?, recurrence_source = ?, series_id = ?, series_name = ?, calendar_event_id = ?,
        sync_mode = ?, sync_provider = ?, external_calendar_id = ?, external_event_id = ?, last_synced_at = ?,
        scheduled_start_at = ?, scheduled_end_at = ?, execution_note = ?,
        goal_id = ?, updated_at = ?, started_at = ?, completed_at = ?, column_id = ?
    WHERE id = ?
  `).run(
    next.title,
    next.details ?? '',
    next.status,
    next.focusDate ?? null,
    next.dueDate ?? null,
    next.importance,
    next.frictionType,
    next.recurrenceRule ?? 'none',
    next.recurrenceSource ?? 'manual',
    next.seriesId ?? null,
    next.seriesName ?? null,
    next.calendarEventId ?? null,
    next.syncMode ?? 'none',
    next.syncProvider ?? null,
    next.externalCalendarId ?? null,
    next.externalEventId ?? null,
    next.lastSyncedAt ?? null,
    next.scheduledStartAt ?? null,
    next.scheduledEndAt ?? null,
    next.executionNote ?? '',
    next.goalId ?? null,
    next.updatedAt,
    next.startedAt ?? null,
    next.completedAt ?? null,
    next.columnId,
    workItemId
  )

  return getPlannerWorkItem(workItemId)
}

function ensureNextRecurringOccurrence(existing) {
  if (!existing.seriesId || !existing.recurrenceRule || existing.recurrenceRule === 'none') {
    return null
  }

  const anchorDate = existing.focusDate ?? existing.dueDate ?? todayKey()
  const nextDate = nextOccurrenceDate(existing.recurrenceRule, anchorDate)
  if (!nextDate) return null

  const db = getDb()
  const existingFuture = db
    .prepare(`
      SELECT id FROM planner_work_items
      WHERE series_id = ? AND status != 'done' AND focus_date IS NOT NULL AND focus_date >= ?
      LIMIT 1
    `)
    .get(existing.seriesId, nextDate)

  if (existingFuture) return null

  const inboxColumn =
    listBoardColumns(existing.boardId).find((column) => column.columnKind === 'inbox') ??
    listBoardColumns(existing.boardId)[0]

  if (!inboxColumn) return null

  return createPlannerWorkItem({
    boardId: existing.boardId,
    columnId: inboxColumn.id,
    title: existing.seriesName ?? existing.title,
    details: existing.details,
    importance: existing.importance,
    frictionType: existing.frictionType,
    recurrenceRule: existing.recurrenceRule,
    recurrenceSource: existing.recurrenceSource,
    seriesId: existing.seriesId,
    seriesName: existing.seriesName ?? existing.title,
    calendarEventId: existing.calendarEventId,
    syncMode: existing.syncMode ?? 'none',
    syncProvider: existing.syncProvider ?? null,
    externalCalendarId: existing.externalCalendarId ?? null,
    externalEventId: existing.externalEventId ?? null,
    focusDate: nextDate,
    dueDate: nextDate,
    scheduledStartAt: existing.scheduledStartAt ?? null,
    scheduledEndAt: existing.scheduledEndAt ?? null,
    executionNote: '',
    goalId: existing.goalId
  })
}

export function movePlannerWorkItem(workItemId, input) {
  const existing = getPlannerWorkItem(workItemId)
  if (!existing) throw new Error(`Unknown work item: ${workItemId}`)

  const board = getPlannerBoard(existing.boardId)
  const column = listBoardColumns(existing.boardId).find((item) => item.id === input.columnId)
  if (!board || !column) throw new Error(`Unknown target column: ${input.columnId}`)

  const now = nowIso()
  const next = {
    ...existing,
    columnId: column.id,
    focusDate: input.focusDate ?? existing.focusDate,
    syncMode:
      existing.syncProvider === 'microsoft'
        ? existing.syncMode === 'planner_to_calendar'
          ? 'planner_to_calendar'
          : 'bidirectional'
        : existing.syncMode,
    updatedAt: now
  }

  if (column.columnKind === 'today' && !next.focusDate) {
    next.focusDate = todayKey()
  }

  if (column.columnKind === 'in_progress') {
    next.status = 'in_progress'
    next.startedAt = existing.startedAt ?? now
    next.completedAt = null
  } else if (column.columnKind === 'done') {
    next.status = 'done'
    next.completedAt = now
  } else {
    next.status = 'planned'
    next.completedAt = null
  }

  const updated = updatePlannerWorkItem(workItemId, next)
  const db = getDb()
  db.prepare(`
    INSERT INTO planner_events (id, entity_type, entity_id, event_type, payload_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `event-${Math.random().toString(36).slice(2, 10)}`,
    'work_item',
    workItemId,
    column.columnKind === 'done' ? 'completed' : 'moved',
    JSON.stringify({ boardId: board.id, columnId: column.id, focusDate: next.focusDate }),
    now
  )

  if (column.columnKind === 'done') {
    const spawned = ensureNextRecurringOccurrence(updated)
    if (spawned) {
      db.prepare(`
        INSERT INTO planner_events (id, entity_type, entity_id, event_type, payload_json, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        generateId('event'),
        'series',
        updated.seriesId,
        'next_occurrence_created',
        JSON.stringify({ completedWorkItemId: updated.id, nextWorkItemId: spawned.id, nextDate: spawned.focusDate }),
        now
      )
    }
  }

  return updated
}

export function createPlannerActionRun(run) {
  const db = getDb()
  const runId = run.id ?? `run-${Math.random().toString(36).slice(2, 10)}`
  const createdAt = nowIso()

  db.prepare(`
    INSERT INTO planner_action_runs (
      id, action_id, source_type, source_id, status, result_summary, error_message, artifacts_json, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    run.actionId,
    run.sourceType,
    run.sourceId ?? null,
    run.status,
    run.resultSummary ?? null,
    run.errorMessage ?? null,
    JSON.stringify(run.artifacts ?? []),
    createdAt,
    run.completedAt ?? createdAt
  )

  return getPlannerActionRun(runId)
}

export function getPlannerActionRun(runId) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM planner_action_runs WHERE id = ? LIMIT 1').get(runId)
  if (!row) return null

  return {
    id: row.id,
    actionId: row.action_id,
    source: {
      type: row.source_type,
      id: row.source_id
    },
    status: row.status,
    resultSummary: row.result_summary,
    errorMessage: row.error_message,
    artifacts: parseJson(row.artifacts_json, []),
    createdAt: row.created_at,
    completedAt: row.completed_at
  }
}

export function listRecentEvents(limit = 50) {
  const db = getDb()
  return db.prepare('SELECT * FROM planner_events ORDER BY occurred_at DESC LIMIT ?').all(limit)
}

export function importCalendarEventsToPlanner(events, options = {}) {
  const imported = []
  const updated = []
  const boardId = options.boardId ?? 'board-daily'
  const board = getPlannerBoard(boardId)
  if (!board) {
    throw new Error(`Unknown board: ${boardId}`)
  }

  const inboxColumn =
    listBoardColumns(board.id).find((column) => column.columnKind === 'inbox') ??
    listBoardColumns(board.id)[0]

  if (!inboxColumn) {
    throw new Error(`Board ${board.id} does not have any columns`)
  }

  for (const event of events) {
    const externalEventId = event.id ?? null
    if (!externalEventId) continue
    if (isSuppressedExternalEvent(externalEventId)) continue

    const focusDate = String(event.start ?? '').slice(0, 10) || null
    const scheduledStartAt = event.start ?? null
    const scheduledEndAt = event.end ?? null
    const recurrence = resolveMicrosoftRecurrenceRule(event.recurrence)
    const seriesId = event.seriesMasterId ? `microsoft-series-${event.seriesMasterId}` : null
    const summaryExternalEventId = event.seriesMasterId ? `series-summary:${event.seriesMasterId}` : null
    if (summaryExternalEventId && isSuppressedExternalEvent(summaryExternalEventId)) {
      continue
    }
    const existing = getPlannerWorkItemByExternalEventId(externalEventId)
    const targetColumn =
      focusDate === todayKey()
        ? listBoardColumns(board.id).find((column) => column.columnKind === 'today') ?? inboxColumn
        : inboxColumn

    if (seriesId && summaryExternalEventId) {
      const existingSummary = getPlannerWorkItemByExternalEventId(summaryExternalEventId)
      const summaryPatch = {
        title: event.subject ?? 'Calendar event',
        details: event.webLink
          ? `Recurring series from Microsoft Calendar\n\nCalendar: ${event.webLink}`
          : 'Recurring series from Microsoft Calendar',
        status: 'planned',
        focusDate: null,
        dueDate: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        recurrenceRule: recurrence,
        recurrenceSource: 'calendar',
        syncMode: 'calendar_to_planner',
        syncProvider: 'microsoft',
        externalCalendarId: 'primary',
        externalEventId: summaryExternalEventId,
        calendarEventId: event.seriesMasterId,
        lastSyncedAt: nowIso(),
        startedAt: null,
        completedAt: null,
        columnId: inboxColumn.id,
        seriesId,
        seriesName: event.subject ?? 'Calendar event'
      }

      if (existingSummary) {
        const nextSummary = updatePlannerWorkItem(existingSummary.id, summaryPatch)
        updated.push(nextSummary)
      } else {
        const summaryItem = createPlannerWorkItem({
          boardId: board.id,
          columnId: inboxColumn.id,
          title: event.subject ?? 'Calendar event',
          details: event.webLink
            ? `Recurring series from Microsoft Calendar\n\nCalendar: ${event.webLink}`
            : 'Recurring series from Microsoft Calendar',
          importance: 'normal',
          frictionType: 'neutral',
          recurrenceRule: recurrence,
          recurrenceSource: 'calendar',
          seriesId,
          seriesName: event.subject ?? 'Calendar event',
          calendarEventId: event.seriesMasterId,
          syncMode: 'calendar_to_planner',
          syncProvider: 'microsoft',
          externalCalendarId: 'primary',
          externalEventId: summaryExternalEventId,
          lastSyncedAt: nowIso()
        })
        imported.push(summaryItem)
      }

      // Keep concrete recurring occurrences as real planner items as well.
      // The summary row is useful for series-level context, but future instances
      // should still exist so week planning can show the actual day/time.
    }

    if (existing) {
      const preservePlannerOverrides = existing.syncProvider === 'microsoft' && existing.syncMode !== 'calendar_to_planner'
      const next = updatePlannerWorkItem(existing.id, {
        title: event.subject ?? existing.title,
        details: event.webLink ? `${existing.details ? `${existing.details}\n\n` : ''}Calendar: ${event.webLink}` : existing.details,
        focusDate: preservePlannerOverrides ? existing.focusDate : focusDate,
        dueDate: preservePlannerOverrides ? existing.dueDate : focusDate,
        scheduledStartAt: preservePlannerOverrides ? existing.scheduledStartAt : scheduledStartAt,
        scheduledEndAt: preservePlannerOverrides ? existing.scheduledEndAt : scheduledEndAt,
        recurrenceRule: recurrence,
        recurrenceSource: 'calendar',
        syncMode: preservePlannerOverrides
          ? existing.syncMode
          : existing.syncMode === 'planner_to_calendar'
            ? 'bidirectional'
            : 'calendar_to_planner',
        syncProvider: 'microsoft',
        externalCalendarId: 'primary',
        externalEventId,
        calendarEventId: externalEventId,
        lastSyncedAt: nowIso(),
        columnId: existing.columnId
      })
      updated.push(next)
      continue
    }

    const item = createPlannerWorkItem({
      boardId: board.id,
      columnId: targetColumn.id,
      title: event.subject ?? 'Calendar event',
      details: event.webLink ? `Imported from Microsoft Calendar\n\nCalendar: ${event.webLink}` : 'Imported from Microsoft Calendar',
      focusDate,
      dueDate: focusDate,
      scheduledStartAt,
      scheduledEndAt,
        importance: 'normal',
        frictionType: 'neutral',
        recurrenceRule: recurrence,
        recurrenceSource: 'calendar',
        seriesId,
        seriesName: event.subject ?? 'Calendar event',
        calendarEventId: externalEventId,
        syncMode: 'calendar_to_planner',
      syncProvider: 'microsoft',
      externalCalendarId: 'primary',
      externalEventId,
      lastSyncedAt: nowIso()
    })
    imported.push(item)
  }

  return { imported, updated }
}

export function getPlannerMetrics() {
  const db = getDb()
  const today = todayKey()
  const weekStart = startOfWeekKey()

  const inProgressCount = db
    .prepare('SELECT COUNT(*) AS count FROM planner_work_items WHERE status = ?')
    .get('in_progress').count
  const completedTodayCount = db
    .prepare('SELECT COUNT(*) AS count FROM planner_work_items WHERE completed_at IS NOT NULL AND substr(completed_at, 1, 10) = ?')
    .get(today).count
  const completedThisWeekCount = db
    .prepare('SELECT COUNT(*) AS count FROM planner_work_items WHERE completed_at IS NOT NULL AND substr(completed_at, 1, 10) >= ?')
    .get(weekStart).count
  const carryOverCount = db
    .prepare('SELECT COUNT(*) AS count FROM planner_work_items WHERE status != ? AND focus_date IS NOT NULL AND focus_date < ?')
    .get('done', today).count

  return {
    today,
    weekStart,
    inProgressCount,
    completedTodayCount,
    completedThisWeekCount,
    carryOverCount
  }
}

export function getPlannerDbPath() {
  return dbPath
}
