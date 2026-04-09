import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const pendingStates = new Map()

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createCodeVerifier() {
  return base64UrlEncode(randomBytes(48))
}

function createCodeChallenge(codeVerifier) {
  return base64UrlEncode(createHash('sha256').update(codeVerifier).digest())
}

function cleanupPendingStates() {
  const now = Date.now()
  for (const [state, entry] of pendingStates.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) {
      pendingStates.delete(state)
    }
  }
}

function toIsoFromExpiresIn(acquiredAt, expiresIn) {
  const expiresInSeconds = Number(expiresIn ?? 0)
  return new Date(acquiredAt.getTime() + expiresInSeconds * 1000).toISOString()
}

async function writeTokenFile(tokenFilePath, payload) {
  await mkdir(path.dirname(tokenFilePath), { recursive: true })
  await writeFile(tokenFilePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

async function readTokenFile(tokenFilePath) {
  try {
    const raw = await readFile(tokenFilePath, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function deleteTokenFile(tokenFilePath) {
  await rm(tokenFilePath, { force: true })
}

async function postTokenRequest(config, body) {
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body)
  })

  const payload = await response.json()
  if (!response.ok) {
    const detail = payload?.error_description ?? payload?.error ?? 'Unknown Microsoft token error'
    throw new Error(`Microsoft token request failed: ${detail}`)
  }

  return payload
}

function buildStoredToken(config, tokenResponse, existingToken = null) {
  const acquiredAt = new Date()
  return {
    provider: 'microsoft',
    tenantId: config.tenantId,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    tokenType: tokenResponse.token_type ?? 'Bearer',
    scope: tokenResponse.scope ?? config.scopes.join(' '),
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? existingToken?.refreshToken ?? null,
    idToken: tokenResponse.id_token ?? existingToken?.idToken ?? null,
    acquiredAt: acquiredAt.toISOString(),
    expiresAt: toIsoFromExpiresIn(acquiredAt, tokenResponse.expires_in),
    refreshedAt: existingToken ? acquiredAt.toISOString() : null
  }
}

async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const payload = await response.json()
  if (!response.ok) {
    const detail = payload?.error?.message ?? 'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph profile request failed: ${detail}`)
  }

  return payload
}

async function fetchMicrosoftGraphJson(accessToken, relativePath, searchParams = {}, extraHeaders = {}) {
  const url = new URL(`https://graph.microsoft.com/v1.0${relativePath}`)

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders
    }
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  if (payload === null) {
    throw new Error('Microsoft Graph returned a non-JSON success response')
  }

  return payload
}

async function fetchMicrosoftGraphJsonByUrl(accessToken, absoluteUrl, extraHeaders = {}) {
  const response = await fetch(absoluteUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders
    }
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  if (payload === null) {
    throw new Error('Microsoft Graph returned a non-JSON success response')
  }

  return payload
}

async function putMicrosoftGraphBinary(accessToken, relativePath, body, contentType) {
  const url = new URL(`https://graph.microsoft.com/v1.0${relativePath}`)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType
    },
    body
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  if (payload === null) {
    throw new Error('Microsoft Graph returned a non-JSON success response')
  }

  return payload
}

async function patchMicrosoftGraphJson(accessToken, relativePath, body) {
  const url = new URL(`https://graph.microsoft.com/v1.0${relativePath}`)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  return payload
}

async function patchMicrosoftGraphJsonWithHeaders(accessToken, relativePath, body, extraHeaders = {}) {
  const url = new URL(`https://graph.microsoft.com/v1.0${relativePath}`)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  return payload
}

async function postMicrosoftGraphJson(accessToken, relativePath, body, extraHeaders = {}) {
  const url = new URL(`https://graph.microsoft.com/v1.0${relativePath}`)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  })

  const rawBody = await response.text()
  let payload = null

  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ??
      payload?.error_description ??
      rawBody?.trim() ??
      'Unknown Microsoft Graph error'
    throw new Error(`Microsoft Graph request failed: ${response.status}:${detail}`)
  }

  if (payload === null) {
    throw new Error('Microsoft Graph returned a non-JSON success response')
  }

  return payload
}

export function createMicrosoftAuth(configInput) {
  const config = {
    publicUrl: (configInput.publicUrl ?? 'http://127.0.0.1:8787').replace(/\/$/, ''),
    tenantId: configInput.tenantId ?? 'common',
    clientId: configInput.clientId ?? '',
    clientSecret: configInput.clientSecret ?? '',
    scopes: Array.isArray(configInput.scopes) ? configInput.scopes : [],
    tokenFilePath: configInput.tokenFilePath
  }

  config.redirectUri = `${config.publicUrl}/api/auth/microsoft/callback`
  config.authorizeEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`
  config.tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`

  function getConfigSummary() {
    return {
      provider: 'microsoft',
      configured: Boolean(config.clientId),
      tenantId: config.tenantId,
      clientIdConfigured: Boolean(config.clientId),
      clientSecretConfigured: Boolean(config.clientSecret),
      publicUrl: config.publicUrl,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      tokenFilePath: config.tokenFilePath
    }
  }

  async function getStatus() {
    const storedToken = await readTokenFile(config.tokenFilePath)
    const tokenAvailable = Boolean(storedToken?.refreshToken || storedToken?.accessToken)
    const configured = Boolean(config.clientId)

    return {
      ...getConfigSummary(),
      configured,
      authenticated: configured && tokenAvailable,
      tokenAvailable,
      usable: configured && tokenAvailable,
      expiresAt: storedToken?.expiresAt ?? null,
      scope: storedToken?.scope ?? null,
      hasRefreshToken: Boolean(storedToken?.refreshToken),
      tokenStored: Boolean(storedToken)
    }
  }

  function getAuthorizationUrl() {
    if (!config.clientId) {
      throw new Error('Microsoft auth is not configured: missing OPERATOR_HUB_MS_CLIENT_ID')
    }

    cleanupPendingStates()

    const state = base64UrlEncode(randomBytes(24))
    const codeVerifier = createCodeVerifier()
    const codeChallenge = createCodeChallenge(codeVerifier)

    pendingStates.set(state, {
      codeVerifier,
      createdAt: Date.now()
    })

    const url = new URL(config.authorizeEndpoint)
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('scope', config.scopes.join(' '))
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')

    return url.toString()
  }

  async function exchangeAuthorizationCode({ code, state }) {
    if (!config.clientId) {
      throw new Error('Microsoft auth is not configured: missing OPERATOR_HUB_MS_CLIENT_ID')
    }

    cleanupPendingStates()
    const pending = pendingStates.get(state)
    if (!pending) {
      throw new Error('Invalid or expired Microsoft OAuth state')
    }

    pendingStates.delete(state)

    const tokenResponse = await postTokenRequest(config, {
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: pending.codeVerifier,
      scope: config.scopes.join(' ')
    })

    const storedToken = buildStoredToken(config, tokenResponse)
    await writeTokenFile(config.tokenFilePath, storedToken)
    return storedToken
  }

  async function ensureAccessToken() {
    if (!config.clientId) {
      throw new Error('Microsoft auth is not configured: missing OPERATOR_HUB_MS_CLIENT_ID')
    }

    const storedToken = await readTokenFile(config.tokenFilePath)
    if (!storedToken) {
      throw new Error('No Microsoft auth token found. Start sign-in at /api/auth/microsoft/start')
    }

    const expiresAt = Date.parse(storedToken.expiresAt ?? '')
    if (!Number.isNaN(expiresAt) && expiresAt > Date.now() + 60_000 && storedToken.accessToken) {
      return storedToken.accessToken
    }

    if (!storedToken.refreshToken) {
      throw new Error('Microsoft auth token expired and no refresh token is available')
    }

    const tokenResponse = await postTokenRequest(config, {
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      grant_type: 'refresh_token',
      refresh_token: storedToken.refreshToken,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' ')
    })

    const refreshedToken = buildStoredToken(config, tokenResponse, storedToken)
    await writeTokenFile(config.tokenFilePath, refreshedToken)
    return refreshedToken.accessToken
  }

  async function getProfile() {
    const accessToken = await ensureAccessToken()
    return fetchMicrosoftProfile(accessToken)
  }

  async function createWorkbookSession(accessToken, driveId, fileId, persistChanges) {
    const payload = await postMicrosoftGraphJson(
      accessToken,
      `/drives/${driveId}/items/${fileId}/workbook/createSession`,
      { persistChanges }
    )

    return payload?.id ?? null
  }

  async function closeWorkbookSession(accessToken, driveId, fileId, sessionId) {
    if (!sessionId) return

    try {
      await postMicrosoftGraphJson(
        accessToken,
        `/drives/${driveId}/items/${fileId}/workbook/closeSession`,
        {},
        { 'workbook-session-id': sessionId }
      )
    } catch {
      // Close is best-effort. Failure here should not mask the main operation result.
    }
  }

  async function listExcelFiles(options = {}) {
    const accessToken = await ensureAccessToken()
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100))
    const searchTerms = options.query
      ? [String(options.query).trim()]
      : ['.xlsx', '.xlsm', '.xls']

    const itemsById = new Map()

    for (const rawTerm of searchTerms) {
      const term = rawTerm.trim()
      if (!term) continue

      const payload = await fetchMicrosoftGraphJson(accessToken, '/me/drive/root/search(q=@q)', {
        '@q': `'${term.replace(/'/g, "''")}'`,
        $top: String(limit),
        $select:
          'id,name,webUrl,size,lastModifiedDateTime,parentReference,file,createdDateTime'
      })

      for (const item of payload.value ?? []) {
        const mimeType = item.file?.mimeType ?? ''
        const fileName = String(item.name ?? '')
        const looksLikeExcel =
          mimeType.includes('spreadsheet') ||
          /\.(xlsx|xlsm|xls)$/i.test(fileName)

        if (!looksLikeExcel) continue

        itemsById.set(item.id, {
          id: item.id,
          name: fileName,
          webUrl: item.webUrl ?? null,
          size: item.size ?? null,
          lastModifiedDateTime: item.lastModifiedDateTime ?? null,
          createdDateTime: item.createdDateTime ?? null,
          mimeType,
          parentPath: item.parentReference?.path ?? null,
          driveId: item.parentReference?.driveId ?? null
        })
      }
    }

    return {
      query: options.query ?? null,
      count: Math.min(itemsById.size, limit),
      files: Array.from(itemsById.values())
        .sort((left, right) => String(left.name).localeCompare(String(right.name)))
        .slice(0, limit)
    }
  }

  async function listCalendarEvents(options = {}) {
    const accessToken = await ensureAccessToken()
    const startDateTime = String(options.startDateTime ?? `${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const endDateTime = String(
      options.endDateTime ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T23:59:59Z'
    )

    const extraHeaders = {
      Prefer: 'outlook.timezone="UTC"'
    }

    const firstPage = await fetchMicrosoftGraphJson(
      accessToken,
      '/me/calendarView',
      {
        startDateTime,
        endDateTime,
        $select: 'id,subject,start,end,isAllDay,webLink,seriesMasterId,recurrence'
      },
      extraHeaders
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft calendar access was denied. Confirm the app has Calendars.Read or Calendars.ReadWrite, then sign in again.'
        )
      }

      throw error
    })

    const events = [...(firstPage.value ?? [])]
    let nextLink = firstPage['@odata.nextLink'] ?? null
    let pageCount = 1

    while (nextLink && pageCount < 20) {
      const nextPage = await fetchMicrosoftGraphJsonByUrl(accessToken, nextLink, extraHeaders)
      events.push(...(nextPage.value ?? []))
      nextLink = nextPage['@odata.nextLink'] ?? null
      pageCount += 1
    }

    return {
      range: { startDateTime, endDateTime },
      events: events.map((event) => ({
        id: event.id ?? null,
        subject: event.subject ?? null,
        start: event.start?.dateTime ?? null,
        startTimeZone: event.start?.timeZone ?? null,
        end: event.end?.dateTime ?? null,
        endTimeZone: event.end?.timeZone ?? null,
        isAllDay: Boolean(event.isAllDay),
        webLink: event.webLink ?? null,
        seriesMasterId: event.seriesMasterId ?? null,
        recurrence: event.recurrence ?? null
      }))
    }
  }

  async function createCalendarEvent(options = {}) {
    const accessToken = await ensureAccessToken()
    const subject = String(options.subject ?? '').trim()
    const startDateTime = String(options.startDateTime ?? '').trim()
    const endDateTime = String(options.endDateTime ?? '').trim()

    if (!subject) throw new Error('Missing subject for calendar event creation')
    if (!startDateTime) throw new Error('Missing startDateTime for calendar event creation')
    if (!endDateTime) throw new Error('Missing endDateTime for calendar event creation')

    const payload = await postMicrosoftGraphJson(accessToken, '/me/events', {
      subject,
      body: options.body
        ? {
            contentType: 'text',
            content: String(options.body)
          }
        : undefined,
      start: {
        dateTime: startDateTime,
        timeZone: String(options.timeZone ?? 'UTC')
      },
      end: {
        dateTime: endDateTime,
        timeZone: String(options.timeZone ?? 'UTC')
      }
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft calendar write was denied. Confirm the app has Calendars.ReadWrite, then sign in again.'
        )
      }

      throw error
    })

    return {
      id: payload.id ?? null,
      subject: payload.subject ?? subject,
      webLink: payload.webLink ?? null,
      calendarId: payload.calendar?.id ?? 'primary',
      start: payload.start?.dateTime ?? startDateTime,
      end: payload.end?.dateTime ?? endDateTime
    }
  }

  async function listExcelFilesInConfiguredFolder(folderConfig, options = {}) {
    if (!folderConfig || typeof folderConfig !== 'object') {
      throw new Error('Microsoft project folder is not configured')
    }

    if (!folderConfig.driveId || !folderConfig.path) {
      throw new Error('Microsoft project folder config is missing driveId or path')
    }

    const accessToken = await ensureAccessToken()
    const payload = await fetchMicrosoftGraphJson(
      accessToken,
      `/drives/${folderConfig.driveId}/root:/${folderConfig.path}:/children`,
      {
        $select:
          'id,name,webUrl,size,lastModifiedDateTime,parentReference,file,createdDateTime'
      }
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft project folder access was denied. This SharePoint library likely needs broader delegated permissions such as Files.Read.All or Sites.Read.All, followed by a new sign-in.'
        )
      }

      throw error
    })

    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 200))
    const items = (payload.value ?? [])
      .filter((item) => {
        const mimeType = item.file?.mimeType ?? ''
        const fileName = String(item.name ?? '')
        return mimeType.includes('spreadsheet') || /\.(xlsx|xlsm|xls)$/i.test(fileName)
      })
      .map((item) => ({
        id: item.id,
        name: item.name ?? null,
        webUrl: item.webUrl ?? null,
        size: item.size ?? null,
        lastModifiedDateTime: item.lastModifiedDateTime ?? null,
        createdDateTime: item.createdDateTime ?? null,
        mimeType: item.file?.mimeType ?? null,
        parentPath: item.parentReference?.path ?? null,
        driveId: item.parentReference?.driveId ?? folderConfig.driveId
      }))
      .slice(0, limit)

    return {
      folder: {
        windowsSyncPath: folderConfig.windowsSyncPath ?? null,
        driveId: folderConfig.driveId,
        path: folderConfig.path,
        siteUrl: folderConfig.siteUrl ?? null,
        libraryName: folderConfig.libraryName ?? null
      },
      count: items.length,
      files: items
    }
  }

  async function createExcelFileInConfiguredFolder(folderConfig, options = {}) {
    if (!folderConfig || typeof folderConfig !== 'object') {
      throw new Error('Microsoft project folder is not configured')
    }

    if (!folderConfig.driveId || !folderConfig.path) {
      throw new Error('Microsoft project folder config is missing driveId or path')
    }

    const fileName = String(options.fileName ?? '').trim()
    if (!fileName) {
      throw new Error('Missing fileName for project Excel file creation')
    }

    const accessToken = await ensureAccessToken()
    const normalizedFileName = /\.(xlsx|xlsm)$/i.test(fileName) ? fileName : `${fileName}.xlsx`
    const encodedPath = folderConfig.path
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')
    const encodedFileName = encodeURIComponent(normalizedFileName)

    const createdItem = await putMicrosoftGraphBinary(
      accessToken,
      `/drives/${folderConfig.driveId}/root:/${encodedPath}/${encodedFileName}:/content`,
      options.content,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft project folder write access was denied. Confirm the app has Files.ReadWrite.All and Sites.ReadWrite.All, then sign in again.'
        )
      }

      throw error
    })

    return {
      folder: {
        windowsSyncPath: folderConfig.windowsSyncPath ?? null,
        driveId: folderConfig.driveId,
        path: folderConfig.path,
        siteUrl: folderConfig.siteUrl ?? null,
        libraryName: folderConfig.libraryName ?? null
      },
      file: {
        id: createdItem.id ?? null,
        name: createdItem.name ?? normalizedFileName,
        webUrl: createdItem.webUrl ?? null,
        size: createdItem.size ?? null,
        lastModifiedDateTime: createdItem.lastModifiedDateTime ?? null
      }
    }
  }

  async function getWorkbookMetadataInConfiguredFolder(folderConfig, options = {}) {
    if (!folderConfig || typeof folderConfig !== 'object') {
      throw new Error('Microsoft project folder is not configured')
    }

    if (!folderConfig.driveId) {
      throw new Error('Microsoft project folder config is missing driveId')
    }

    const fileId = String(options.fileId ?? '').trim()
    if (!fileId) {
      throw new Error('Missing fileId for workbook metadata lookup')
    }

    const accessToken = await ensureAccessToken()
    const driveId = folderConfig.driveId

    const item = await fetchMicrosoftGraphJson(accessToken, `/drives/${driveId}/items/${fileId}`, {
      $select:
        'id,name,webUrl,size,lastModifiedDateTime,createdDateTime,parentReference,file'
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft workbook metadata access was denied. Confirm the app has Files.ReadWrite.All and Sites.ReadWrite.All, then sign in again.'
        )
      }

      throw error
    })

    const worksheetsPayload = await fetchMicrosoftGraphJson(
      accessToken,
      `/drives/${driveId}/items/${fileId}/workbook/worksheets`,
      {
        $select: 'id,name,position,visibility'
      }
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft workbook worksheet access was denied. Confirm the app has Files.ReadWrite.All and Sites.ReadWrite.All, then sign in again.'
        )
      }

      throw error
    })

    return {
      folder: {
        windowsSyncPath: folderConfig.windowsSyncPath ?? null,
        driveId,
        path: folderConfig.path ?? null,
        siteUrl: folderConfig.siteUrl ?? null,
        libraryName: folderConfig.libraryName ?? null
      },
      file: {
        id: item.id ?? fileId,
        name: item.name ?? null,
        webUrl: item.webUrl ?? null,
        size: item.size ?? null,
        lastModifiedDateTime: item.lastModifiedDateTime ?? null,
        createdDateTime: item.createdDateTime ?? null,
        mimeType: item.file?.mimeType ?? null,
        parentPath: item.parentReference?.path ?? null
      },
      worksheets: (worksheetsPayload.value ?? []).map((sheet) => ({
        id: sheet.id ?? null,
        name: sheet.name ?? null,
        position: sheet.position ?? null,
        visibility: sheet.visibility ?? null
      }))
    }
  }

  async function readWorkbookRangeInConfiguredFolder(folderConfig, options = {}) {
    if (!folderConfig || typeof folderConfig !== 'object') {
      throw new Error('Microsoft project folder is not configured')
    }

    if (!folderConfig.driveId) {
      throw new Error('Microsoft project folder config is missing driveId')
    }

    const fileId = String(options.fileId ?? '').trim()
    const worksheetName = String(options.worksheetName ?? '').trim()
    const address = String(options.address ?? '').trim()

    if (!fileId) throw new Error('Missing fileId for workbook range read')
    if (!worksheetName) throw new Error('Missing worksheetName for workbook range read')
    if (!address) throw new Error('Missing address for workbook range read')

    const accessToken = await ensureAccessToken()
    const driveId = folderConfig.driveId
    const encodedSheet = encodeURIComponent(worksheetName.replace(/'/g, "''"))
    const encodedAddress = encodeURIComponent(address)

    const payload = await fetchMicrosoftGraphJson(
      accessToken,
      `/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodedSheet}')/range(address='${encodedAddress}')`
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('403:') || message.includes('accessDenied')) {
        throw new Error(
          'Microsoft workbook range access was denied. Confirm the app has Files.ReadWrite.All and Sites.ReadWrite.All, then sign in again.'
        )
      }

      throw error
    })

    return {
      folder: {
        windowsSyncPath: folderConfig.windowsSyncPath ?? null,
        driveId,
        path: folderConfig.path ?? null,
        siteUrl: folderConfig.siteUrl ?? null,
        libraryName: folderConfig.libraryName ?? null
      },
      fileId,
      worksheetName,
      address,
      rowCount: payload.rowCount ?? null,
      columnCount: payload.columnCount ?? null,
      text: payload.text ?? [],
      values: payload.values ?? [],
      valueTypes: payload.valueTypes ?? []
    }
  }

  async function writeWorkbookRangeInConfiguredFolder(folderConfig, options = {}) {
    if (!folderConfig || typeof folderConfig !== 'object') {
      throw new Error('Microsoft project folder is not configured')
    }

    if (!folderConfig.driveId) {
      throw new Error('Microsoft project folder config is missing driveId')
    }

    const fileId = String(options.fileId ?? '').trim()
    const worksheetName = String(options.worksheetName ?? '').trim()
    const address = String(options.address ?? '').trim()
    const values = options.values

    if (!fileId) throw new Error('Missing fileId for workbook range write')
    if (!worksheetName) throw new Error('Missing worksheetName for workbook range write')
    if (!address) throw new Error('Missing address for workbook range write')
    if (!Array.isArray(values)) throw new Error('Workbook range write values must be a 2D array')

    const accessToken = await ensureAccessToken()
    const driveId = folderConfig.driveId
    const encodedSheet = encodeURIComponent(worksheetName.replace(/'/g, "''"))
    const encodedAddress = encodeURIComponent(address)
    const sessionId = await createWorkbookSession(accessToken, driveId, fileId, true)

    try {
      await patchMicrosoftGraphJsonWithHeaders(
        accessToken,
        `/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodedSheet}')/range(address='${encodedAddress}')`,
        {
          values
        },
        sessionId ? { 'workbook-session-id': sessionId } : {}
      ).catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('403:') || message.includes('accessDenied')) {
          throw new Error(
            'Microsoft workbook range write was denied. Confirm the app has Files.ReadWrite.All and Sites.ReadWrite.All, then sign in again.'
          )
        }

        throw error
      })

      const payload = await fetchMicrosoftGraphJson(
        accessToken,
        `/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodedSheet}')/range(address='${encodedAddress}')`,
        {},
        sessionId ? { 'workbook-session-id': sessionId } : {}
      )

      return {
        folder: {
          windowsSyncPath: folderConfig.windowsSyncPath ?? null,
          driveId,
          path: folderConfig.path ?? null,
          siteUrl: folderConfig.siteUrl ?? null,
          libraryName: folderConfig.libraryName ?? null
        },
        fileId,
        worksheetName,
        address,
        rowCount: payload.rowCount ?? null,
        columnCount: payload.columnCount ?? null,
        text: payload.text ?? [],
        values: payload.values ?? [],
        valueTypes: payload.valueTypes ?? []
      }
    } finally {
      await closeWorkbookSession(accessToken, driveId, fileId, sessionId)
    }
  }

  async function clearSession() {
    await deleteTokenFile(config.tokenFilePath)
    return { ok: true, message: 'Cleared local Microsoft auth session' }
  }

  return {
    getConfigSummary,
    getStatus,
    getAuthorizationUrl,
    exchangeAuthorizationCode,
    ensureAccessToken,
    getProfile,
    listCalendarEvents,
    createCalendarEvent,
    listExcelFiles,
    listExcelFilesInConfiguredFolder,
    createExcelFileInConfiguredFolder,
    getWorkbookMetadataInConfiguredFolder,
    readWorkbookRangeInConfiguredFolder,
    writeWorkbookRangeInConfiguredFolder,
    clearSession
  }
}
