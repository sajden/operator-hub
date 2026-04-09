import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path, { dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

function parseArgs(argv) {
  const args = {
    source: '',
    seedQuery: '',
    preferredAccountText: '',
    url: '',
    htmlOutput: '',
    screenshotOutput: '',
    width: 1440,
    height: 1600,
    waitMs: 8000,
    browser: '',
    userDataDir: '',
    profileDirectory: '',
    remoteDebuggingUrl: '',
    mode: 'background'
  }

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source') args.source = argv[++index] ?? ''
    else if (value === '--seed-query') args.seedQuery = argv[++index] ?? ''
    else if (value === '--preferred-account-text') args.preferredAccountText = argv[++index] ?? ''
    else if (value === '--url') args.url = argv[++index] ?? ''
    else if (value === '--html-output') args.htmlOutput = argv[++index] ?? ''
    else if (value === '--screenshot-output') args.screenshotOutput = argv[++index] ?? ''
    else if (value === '--width') args.width = Number(argv[++index] ?? args.width)
    else if (value === '--height') args.height = Number(argv[++index] ?? args.height)
    else if (value === '--wait-ms') args.waitMs = Number(argv[++index] ?? args.waitMs)
    else if (value === '--browser') args.browser = argv[++index] ?? ''
    else if (value === '--user-data-dir') args.userDataDir = argv[++index] ?? ''
    else if (value === '--profile-directory') args.profileDirectory = argv[++index] ?? ''
    else if (value === '--remote-debugging-url') args.remoteDebuggingUrl = argv[++index] ?? ''
    else if (value === '--mode') args.mode = argv[++index] ?? args.mode
  }

  if (!args.url || !args.htmlOutput || !args.screenshotOutput) {
    throw new Error('Usage: npm run capture -- --source <source> --seed-query <query> --url <https-url> --html-output </abs/path.html> --screenshot-output </abs/path.png> [--remote-debugging-url http://127.0.0.1:9222] [--browser /path/to/chrome] [--user-data-dir /path/to/profile-root] [--profile-directory Default]')
  }

  return args
}

function detectBrowserCommand(configured) {
  const envValue = String(configured || process.env.OPERATOR_HUB_RESEARCH_BROWSER || process.env.OPERATOR_HUB_SCREENSHOT_BROWSER || '').trim()
  if (envValue) return envValue

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge'
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function run(command, args) {
  const isWindowsExecutable = /\.exe$/i.test(command)
  const finalCommand = isWindowsExecutable
    ? '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
    : command
  const quoteWindowsArg = (value) => `'${String(value).replace(/'/g, "''")}'`
  const finalArgs = isWindowsExecutable
    ? ['-NoProfile', '-Command', `& ${quoteWindowsArg(command)} ${args.map((value) => quoteWindowsArg(value)).join(' ')}`]
    : args

  return await new Promise((resolve, reject) => {
    const child = spawn(finalCommand, finalArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: isWindowsExecutable ? '/mnt/c' : process.cwd()
    })

    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(String(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.join('').trim() || stdout.join('').trim() || `Browser process exited with code ${code}`))
        return
      }

      resolve({
        stdout: stdout.join(''),
        stderr: stderr.join('')
      })
    })
  })
}

async function runAndCapture(command, args) {
  const result = await run(command, args)
  return result.stdout.trim()
}

async function toWindowsPath(value) {
  return await runAndCapture('wslpath', ['-w', value])
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Remote debugging request failed with ${response.status}`)
  }
  return response.json()
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isIgnorableBrowserShutdownError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /ESRCH|Target page, context or browser has been closed|Browser has been closed|Connection closed/i.test(message)
}

async function safeClose(playwrightObject) {
  if (!playwrightObject || typeof playwrightObject.close !== 'function') return
  try {
    await playwrightObject.close()
  } catch (error) {
    if (!isIgnorableBrowserShutdownError(error)) throw error
  }
}

async function cdpCall(socket, nextIdRef, method, params = {}) {
  const id = nextIdRef.value
  nextIdRef.value += 1

  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', onMessage)
      reject(new Error(`CDP timeout for ${method}`))
    }, 15000)

    function onMessage(event) {
      try {
        const payload = JSON.parse(String(event.data))
        if (payload.id !== id) return
        clearTimeout(timeout)
        socket.removeEventListener('message', onMessage)
        if (payload.error) {
          reject(new Error(payload.error.message || `CDP error for ${method}`))
          return
        }
        resolve(payload.result ?? {})
      } catch (error) {
        clearTimeout(timeout)
        socket.removeEventListener('message', onMessage)
        reject(error)
      }
    }

    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })

  return result
}

async function typeTextViaCdp(socket, nextIdRef, text) {
  for (const char of String(text ?? '')) {
    const upper = char.toUpperCase()
    const keyCode = upper.charCodeAt(0)
    await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      text: char,
      unmodifiedText: char,
      key: char,
      code: /[a-z]/i.test(char) ? `Key${upper}` : undefined,
      windowsVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0,
      nativeVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0
    })
    await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
      type: 'char',
      text: char,
      unmodifiedText: char,
      key: char,
      code: /[a-z]/i.test(char) ? `Key${upper}` : undefined,
      windowsVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0,
      nativeVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0
    })
    await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: char,
      code: /[a-z]/i.test(char) ? `Key${upper}` : undefined,
      windowsVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0,
      nativeVirtualKeyCode: Number.isFinite(keyCode) ? keyCode : 0
    })
  }
}

async function clickAt(socket, nextIdRef, x, y) {
  await cdpCall(socket, nextIdRef, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
    button: 'none'
  })
  await cdpCall(socket, nextIdRef, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1
  })
  await cdpCall(socket, nextIdRef, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1
  })
}

async function focusKeywordPlannerSeedInput(socket, nextIdRef) {
  const focusResult = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const target = document.querySelector('split-ideas-input-panel .keywords-panel search-chips-selector input.search-input')
      if (!target) {
        return { focused: false, reason: 'keyword input not found' }
      }
      target.scrollIntoView({ block: 'center', inline: 'center' })
      const rect = target.getBoundingClientRect()
      target.focus()
      target.click?.()
      target.select?.()
      return {
        focused: document.activeElement === target,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        hint: target.getAttribute('aria-label') || target.getAttribute('placeholder') || null
      }
    })()`
  )

  return focusResult.result?.value ?? { focused: false, reason: 'focus script failed' }
}

async function waitForKeywordSeedAccepted(socket, nextIdRef, seed, timeoutMs = 4000) {
  const escapedSeed = JSON.stringify(String(seed).trim().toLowerCase())
  const result = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => new Promise((resolve) => {
      const expected = ${escapedSeed}
      const startedAt = Date.now()
      const check = () => {
        const chips = Array.from(document.querySelectorAll('split-ideas-input-panel .keywords-panel material-chip, split-ideas-input-panel .keywords-panel [role="listitem"], split-ideas-input-panel .keywords-panel .chip'))
          .map((node) => (node.innerText || node.textContent || '').trim().toLowerCase())
          .filter(Boolean)
        const submit = Array.from(document.querySelectorAll('material-button, button, [role="button"]')).find((node) => {
          const text = (node.innerText || node.textContent || node.getAttribute?.('aria-label') || '').trim()
          return text === 'Get results'
        })
        const submitEnabled = Boolean(submit && !submit.classList?.contains('is-disabled') && !submit.hasAttribute?.('disabled') && submit.getAttribute?.('aria-disabled') !== 'true')
        const input = document.querySelector('split-ideas-input-panel .keywords-panel search-chips-selector input.search-input')
        const inputValue = (input?.value || '').trim().toLowerCase()
        const matched = chips.some((chip) => chip.includes(expected))
        if (matched || submitEnabled) {
          resolve({ matched, submitEnabled, chips: chips.slice(0, 12), inputValue })
          return
        }
        if (Date.now() - startedAt > ${timeoutMs}) {
          resolve({ matched: false, submitEnabled, chips: chips.slice(0, 12), inputValue })
          return
        }
        setTimeout(check, 150)
      }
      check()
    }))()`
  )
  return result.result?.value ?? { matched: false, submitEnabled: false, chips: [], inputValue: '' }
}

async function dismissKeywordPlannerDisconnectDialog(socket, nextIdRef) {
  const result = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const bodyText = document.body?.innerText || ''
      if (!/You got disconnected/i.test(bodyText)) {
        return { present: false, clicked: null }
      }
      const candidates = Array.from(document.querySelectorAll('button, material-button, [role="button"], div, span'))
      const continueButton = candidates.find((node) => {
        const text = (node.innerText || node.textContent || node.getAttribute?.('aria-label') || '').trim()
        return text === 'Continue'
      })
      if (continueButton) {
        continueButton.click?.()
        return { present: true, clicked: 'Continue' }
      }
      return { present: true, clicked: null }
    })()`
  )
  return result.result?.value ?? { present: false, clicked: null }
}

async function setKeywordSeedViaDom(socket, nextIdRef, seed) {
  const result = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const target = document.querySelector('split-ideas-input-panel .keywords-panel search-chips-selector input.search-input')
      if (!target) return { ok: false, reason: 'keyword input not found' }
      target.focus()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (setter) setter.call(target, ${JSON.stringify(seed)})
      else target.value = ${JSON.stringify(seed)}
      target.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: ${JSON.stringify(seed)}
      }))
      target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: ${JSON.stringify(seed)}
      }))
      for (const type of ['keydown', 'keypress', 'keyup']) {
        target.dispatchEvent(new KeyboardEvent(type, {
          bubbles: true,
          composed: true,
          key: 'Enter',
          code: 'Enter'
        }))
      }
      target.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
      return {
        ok: true,
        value: target.value || '',
        activeTag: document.activeElement?.tagName || null,
        activeClass: document.activeElement?.className || null
      }
    })()`
  )
  return result.result?.value ?? { ok: false, reason: 'dom input failed' }
}

async function attachToRemoteBrowser(remoteDebuggingUrl, url, htmlOutput, screenshotOutput, waitMs, width, height) {
  const baseUrl = String(remoteDebuggingUrl).replace(/\/+$/, '')
  const target = await fetchJson(`${baseUrl}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  })

  if (!target.webSocketDebuggerUrl || !target.id) {
    throw new Error('Remote debugging target did not return a debuggable tab')
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to remote debugging websocket')), 10000)
    socket.addEventListener('open', () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.addEventListener('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })

  const nextIdRef = { value: 1 }

  try {
    await cdpCall(socket, nextIdRef, 'Page.enable')
    await cdpCall(socket, nextIdRef, 'Runtime.enable')
    await cdpCall(socket, nextIdRef, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    })
    await cdpCall(socket, nextIdRef, 'Page.navigate', { url })
    await delay(waitMs)

    const htmlResult = await cdpCall(socket, nextIdRef, 'Runtime.evaluate', {
      expression: 'document.documentElement ? document.documentElement.outerHTML : ""',
      returnByValue: true
    })
    const titleResult = await cdpCall(socket, nextIdRef, 'Runtime.evaluate', {
      expression: 'document.title || ""',
      returnByValue: true
    })
    const screenshotResult = await cdpCall(socket, nextIdRef, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true
    })

    const html = String(htmlResult.result?.value ?? '')
    await writeFile(htmlOutput, html, 'utf-8')

    let screenshotCreated = false
    if (screenshotResult.data) {
      await writeFile(screenshotOutput, Buffer.from(screenshotResult.data, 'base64'))
      screenshotCreated = true
    }

    return {
      pageTitle: String(titleResult.result?.value ?? '').trim() || null,
      screenshotCreated,
      htmlBytes: Buffer.byteLength(html, 'utf-8'),
      browser: `remote:${baseUrl}`
    }
  } finally {
    try {
      socket.close()
    } catch {}
    try {
      await fetchJson(`${baseUrl}/json/close/${target.id}`)
    } catch {}
  }
}

async function waitForRemoteDebugging(baseUrl, timeoutMs = 15000) {
  const startedAt = Date.now()
  let lastError = null
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const version = await fetchJson(`${baseUrl}/json/version`)
      if (version?.Browser) return version
    } catch (error) {
      lastError = error
    }
    await delay(300)
  }
  throw new Error(lastError instanceof Error ? lastError.message : 'Timed out waiting for browser remote debugging endpoint')
}

async function runBrowserActionScript(socket, nextIdRef, expression) {
  return await cdpCall(socket, nextIdRef, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
}

async function waitForKeywordPlannerState(socket, nextIdRef, expectedState, timeoutMs = 8000) {
  return await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => new Promise((resolve) => {
      const expected = ${JSON.stringify(expectedState)}
      const startedAt = Date.now()
      const interval = setInterval(() => {
        const bodyText = document.body?.innerText || ''
        const hasKeywordForm =
          /Enter products or services closely related to your business/i.test(bodyText) ||
          /Start with keywords/i.test(bodyText) ||
          /Get results/i.test(bodyText)
        const hasNoSuggestions = /No suggestions for/i.test(bodyText)
        const hasResultsToolbar =
          /Add filter/i.test(bodyText) &&
          /Columns/i.test(bodyText) &&
          /0 selected/i.test(bodyText)
        const hasResultsTable =
          /Keyword ideas/i.test(bodyText) &&
          (/Avg\. monthly searches/i.test(bodyText) || /Top of page bid/i.test(bodyText) || /Competition/i.test(bodyText))
        const hasResultsView = hasNoSuggestions || hasResultsTable || (!hasKeywordForm && hasResultsToolbar)

        if ((expected === 'form' && hasKeywordForm) || (expected === 'results' && hasResultsView)) {
          clearInterval(interval)
          resolve({ matched: true, expected, hasKeywordForm, hasResultsView, hasNoSuggestions, hasResultsToolbar, hasResultsTable })
          return
        }

        if (Date.now() - startedAt > ${timeoutMs}) {
          clearInterval(interval)
          resolve({ matched: false, expected, hasKeywordForm, hasResultsView, hasNoSuggestions, hasResultsToolbar, hasResultsTable, bodyPreview: bodyText.slice(0, 500) })
        }
      }, 250)
    }))()`
  )
}

async function performSourceActions(socket, nextIdRef, source, seedQuery, preferredAccountText) {
  if (source !== 'google_keyword_planner' || !seedQuery) {
    return { steps: [] }
  }

  const selectAccount = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const hardClick = (node) => {
        if (!node) return false
        node.scrollIntoView({ block: 'center', inline: 'center' })
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']
        for (const type of events) {
          node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }))
        }
        if (typeof node.click === 'function') node.click()
        return true
      }

      const bodyText = (document.body?.innerText || '')
      if (!/Select a Google Ads account/i.test(bodyText)) {
        return { step: 'select_account', matched: false }
      }

      const items = Array.from(document.querySelectorAll('[role="menuitem"], material-list-item'))
      const normalized = items.map((node) => ({
        node,
        text: (node.innerText || node.textContent || '').trim()
      }))
      const preferredText = ${JSON.stringify(preferredAccountText || '')}
        .trim()
        .toLowerCase()
      const preferred = preferredText
        ? normalized.find((entry) => entry.text.toLowerCase().includes(preferredText))
        : normalized.find((entry) => entry.text && !/manager/i.test(entry.text))
      const fallback = normalized[0]
      const target = preferred?.node || fallback?.node || null
      if (!target) {
        return { step: 'select_account', matched: true, clicked: null }
      }
      hardClick(target)
      return {
        step: 'select_account',
        matched: true,
        clicked: (preferred?.text || fallback?.text || '').slice(0, 120)
      }
    })()`
  )

  await delay(6000)

  const dismissModal = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const hardClick = (node) => {
        if (!node) return false
        node.scrollIntoView({ block: 'center', inline: 'center' })
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']
        for (const type of events) {
          node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }))
        }
        if (typeof node.click === 'function') node.click()
        return true
      }
      const texts = ['Got it', 'Close dialog']
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span, material-button'))
      for (const text of texts) {
        const match = candidates.find((node) => (node.innerText || node.textContent || '').trim() === text || node.getAttribute?.('aria-label') === text)
        if (match) {
          hardClick(match)
          return { step: 'dismiss_modal', clicked: text }
        }
      }
      return { step: 'dismiss_modal', clicked: null }
    })()`
  )

  await delay(2000)
  const dismissDisconnectInitial = await dismissKeywordPlannerDisconnectDialog(socket, nextIdRef)
  if (dismissDisconnectInitial.present) {
    await delay(2000)
  }

  const clickDiscover = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const hardClick = (node) => {
        if (!node) return false
        node.scrollIntoView({ block: 'center', inline: 'center' })
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']
        for (const type of events) {
          node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }))
        }
        if (typeof node.click === 'function') node.click()
        return true
      }
      const candidates = [
        ...Array.from(document.querySelectorAll('[aria-label="Discover new keywords"], .ideas-card, .ideas-content .collapsed-content, [buttondecorator].ideas-card')),
        ...Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
      ]
      const match = candidates.find((node) => {
        const text = (node.innerText || node.textContent || node.getAttribute?.('aria-label') || '').trim()
        return text === 'Discover new keywords' || node.classList?.contains('ideas-card')
      })
      if (match) {
        hardClick(match)
        const parent = match.closest?.('[role="button"], [buttondecorator], .card-frame')
        if (parent && parent !== match) {
          hardClick(parent)
        }
        return {
          step: 'open_planner_flow',
          clicked: (match.getAttribute?.('aria-label') || match.innerText || match.textContent || '').trim() || 'Discover new keywords',
          tag: match.tagName,
          className: match.className || null
        }
      }
      return { step: 'open_planner_flow', clicked: null }
    })()`
  )

  const waitForForm = await waitForKeywordPlannerState(socket, nextIdRef, 'form', 9000)

  const fillSeed = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const rawSeed = ${JSON.stringify(seedQuery)}
      const seeds = rawSeed
        .split(/[\\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
      const visible = (nodes) => nodes.filter((node) => {
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })

      const bodyText = document.body?.innerText || ''
      const formVisible =
        /Enter products or services closely related to your business/i.test(bodyText) ||
        /Start with keywords/i.test(bodyText) ||
        /Get results/i.test(bodyText)
      if (!formVisible) {
        return { step: 'fill_seed', filled: false, reason: 'planner keyword form not visible' }
      }

      const keywordTab = Array.from(document.querySelectorAll('[role="tab"], tab-button')).find((node) => {
        const text = (node.innerText || node.textContent || node.getAttribute?.('aria-label') || '').trim().toLowerCase()
        return text === 'start with keywords'
      })
      if (keywordTab) {
        keywordTab.click?.()
      }

      const exactKeywordInput = document.querySelector('split-ideas-input-panel .keywords-panel search-chips-selector input.search-input')
      const keywordCandidates = visible(
        Array.from(document.querySelectorAll('input.search-input, search-chips-selector input, multi-suggest-input input, material-input input'))
      ).filter((node) => {
        const label = ((node.getAttribute('aria-label') || node.getAttribute('placeholder') || '')).toLowerCase()
        const wrapperText = (node.closest('material-input, search-chips-selector, multi-suggest-input, section, div')?.innerText || '').toLowerCase()
        if (/search for a page or campaign/.test(label)) return false
        if (/filter unrelated keywords|enter a site|website/.test(label)) return false
        if (/filter unrelated keywords|enter a site|start with a website/.test(wrapperText)) return false
        if (/search input/.test(label) && !/products or services|start with keywords|get results|discover new keywords/.test(wrapperText)) {
          return false
        }
        return true
      })
      const target = exactKeywordInput || keywordCandidates.find((node) => {
        const label = ((node.getAttribute('aria-label') || node.getAttribute('placeholder') || '')).toLowerCase()
        const wrapperText = (node.closest('material-input, search-chips-selector, multi-suggest-input, section, div')?.innerText || '').toLowerCase()
        if (/filter unrelated keywords|enter a site|website/.test(label)) return false
        if (/filter unrelated keywords|enter a site|start with a website/.test(wrapperText)) return false
        return /meal delivery|leather boots|products or services|closely related/.test(label) ||
          /products or services|closely related|get results|discover new keywords/.test(wrapperText)
      }) || keywordCandidates[0]

      const websiteInput = visible(
        Array.from(document.querySelectorAll('input[aria-label*="filter unrelated keywords"], input[aria-label*="site"]'))
      )[0] || null

      if (websiteInput) {
        websiteInput.focus()
        websiteInput.value = ''
        websiteInput.dispatchEvent(new Event('input', { bubbles: true }))
        websiteInput.dispatchEvent(new Event('change', { bubbles: true }))
      }

      if (!target) return { step: 'fill_seed', filled: false, reason: 'keyword input not found' }

      const clearValue = (node) => {
        node.focus()
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        if (descriptor && descriptor.set) descriptor.set.call(node, '')
        else node.value = ''
        node.dispatchEvent(new Event('input', { bubbles: true }))
        node.dispatchEvent(new Event('change', { bubbles: true }))
      }

      clearValue(target)

      const removeChipButtons = Array.from(document.querySelectorAll('[aria-label*="Remove"], [aria-label*="remove"], material-icon'))
        .filter((node) => /remove|close/i.test((node.getAttribute?.('aria-label') || node.innerText || node.textContent || '').trim()))
      for (const button of removeChipButtons.slice(0, 20)) {
        try {
          button.click?.()
        } catch {}
      }

      target.focus()
      return {
        step: 'fill_seed',
        filled: seeds.length > 0,
        seedCount: seeds.length,
        targetTag: target.tagName,
        targetHint: (target.getAttribute && (target.getAttribute('aria-label') || target.getAttribute('placeholder'))) || null,
        websiteCleared: Boolean(websiteInput)
      }
    })()`
  )

  const seedAcceptance = []
  if (fillSeed.result?.value?.filled) {
    const seeds = String(seedQuery)
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean)
    for (const seed of seeds) {
      const focusInfo = await focusKeywordPlannerSeedInput(socket, nextIdRef)
      if (typeof focusInfo.x === 'number' && typeof focusInfo.y === 'number') {
        await clickAt(socket, nextIdRef, focusInfo.x, focusInfo.y)
      }
      await cdpCall(socket, nextIdRef, 'Input.insertText', { text: seed })
      await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
      })
      await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
      })
      await delay(350)
      let accepted = await waitForKeywordSeedAccepted(socket, nextIdRef, seed, 5000)
      if (!accepted.matched && !accepted.submitEnabled) {
        await setKeywordSeedViaDom(socket, nextIdRef, seed)
        await typeTextViaCdp(socket, nextIdRef, seed)
        await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13
        })
        await cdpCall(socket, nextIdRef, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13
        })
        await delay(350)
        accepted = await waitForKeywordSeedAccepted(socket, nextIdRef, seed, 5000)
      }
      seedAcceptance.push({ seed, ...accepted })
    }
  }

  await delay(1500)
  const dismissDisconnectBeforeSubmit = await dismissKeywordPlannerDisconnectDialog(socket, nextIdRef)
  if (dismissDisconnectBeforeSubmit.present) {
    await delay(1500)
  }

  const submit = await runBrowserActionScript(
    socket,
    nextIdRef,
    `(() => {
      const hardClick = (node) => {
        if (!node) return false
        node.scrollIntoView({ block: 'center', inline: 'center' })
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']
        for (const type of events) {
          node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }))
        }
        if (typeof node.click === 'function') node.click()
        return true
      }
      const exactSubmit = document.querySelector('split-ideas-input-panel material-button.submit-button, split-ideas-input-panel .submit-button')
      if (exactSubmit) {
        const disabled = exactSubmit.classList?.contains('is-disabled') || exactSubmit.hasAttribute?.('disabled') || exactSubmit.getAttribute?.('aria-disabled') === 'true'
        if (!disabled) {
          hardClick(exactSubmit)
          return {
            step: 'submit_seed',
            clicked: 'Get results',
            tag: exactSubmit.tagName,
            className: exactSubmit.className || null
          }
        }
      }
      const texts = ['Get results', 'Discover', 'Apply', 'Next']
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span, material-button'))
      for (const text of texts) {
        const match = candidates.find((node) => {
          const label = ((node.innerText || node.textContent || '').trim() || node.getAttribute?.('aria-label') || '').trim()
          return label === text
        })
        if (match) {
          hardClick(match)
          return {
            step: 'submit_seed',
            clicked: text,
            tag: match.tagName,
            className: match.className || null
          }
        }
      }
      const enterInput = Array.from(document.querySelectorAll('input')).find((node) => {
        const label = ((node.getAttribute('aria-label') || node.getAttribute('placeholder') || '')).toLowerCase()
        if (/search for a page or campaign/.test(label)) return false
        return /meal delivery|leather boots|products or services|closely related/.test(label)
      })
      if (enterInput) {
        enterInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
        enterInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }))
        enterInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
        return { step: 'submit_seed', clicked: 'Enter', tag: enterInput.tagName, className: enterInput.className || null }
      }
      return { step: 'submit_seed', clicked: null }
    })()`
  )

  const waitForResults = await waitForKeywordPlannerState(socket, nextIdRef, 'results', 12000)
  const dismissDisconnectAfterResults = await dismissKeywordPlannerDisconnectDialog(socket, nextIdRef)

  return {
    steps: [
      selectAccount.result?.value ?? null,
      dismissModal.result?.value ?? null,
      dismissDisconnectInitial,
      clickDiscover.result?.value ?? null,
      waitForForm.result?.value ?? null,
      fillSeed.result?.value ?? null,
      { step: 'seed_acceptance', items: seedAcceptance },
      dismissDisconnectBeforeSubmit,
      submit.result?.value ?? null,
      waitForResults.result?.value ?? null,
      dismissDisconnectAfterResults
    ].filter(Boolean)
  }
}

async function launchLocalBrowserForCdp(browserCommand, args) {
  const child = spawn(browserCommand, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  })

  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})

  child.on('error', (error) => {
    process.stderr.write(`${String(error)}\n`)
  })

  return child
}

async function stopBrowserProcess(child) {
  if (!child || child.exitCode !== null) return

  const waitForClose = new Promise((resolve) => {
    child.once('close', resolve)
  })

  try {
    child.kill('SIGTERM')
  } catch {
    return
  }

  await Promise.race([waitForClose, delay(1200)])

  if (child.exitCode === null) {
    try {
      child.kill('SIGKILL')
    } catch {}
    await Promise.race([waitForClose, delay(800)])
  }
}

async function captureViaLocalBrowserCdp({
  browserCommand,
  url,
  htmlOutput,
  screenshotOutput,
  width,
  height,
  waitMs,
  userDataDir,
  profileDirectory,
  source,
  seedQuery,
  preferredAccountText,
  mode
}) {
  const remotePort = 9400 + Math.floor(Math.random() * 400)
  const remoteDebuggingUrl = `http://127.0.0.1:${remotePort}`
  const useIsolatedBackgroundProfile = mode === 'background' && source === 'google_trends'
  const effectiveUserDataDir = useIsolatedBackgroundProfile
    ? await mkdtemp(path.join(os.tmpdir(), 'operator-hub-trends-profile-'))
    : userDataDir
  const launchArgs = [
    `--remote-debugging-port=${remotePort}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'about:blank'
  ]

  if (mode === 'background' && source === 'google_trends') {
    launchArgs.splice(4, 0, '--headless=new')
  }

  if (effectiveUserDataDir) launchArgs.push(`--user-data-dir=${effectiveUserDataDir}`)
  if (!useIsolatedBackgroundProfile && profileDirectory) launchArgs.push(`--profile-directory=${profileDirectory}`)

  const child = await launchLocalBrowserForCdp(browserCommand, launchArgs)

  try {
    await waitForRemoteDebugging(remoteDebuggingUrl, 20000)
    const baseUrl = String(remoteDebuggingUrl).replace(/\/+$/, '')
    const target = await fetchJson(`${baseUrl}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
    if (!target.webSocketDebuggerUrl || !target.id) {
      throw new Error('Local browser did not return a debuggable tab')
    }

    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting to local browser websocket')), 10000)
      socket.addEventListener('open', () => {
        clearTimeout(timeout)
        resolve()
      })
      socket.addEventListener('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    const nextIdRef = { value: 1 }
    try {
      await cdpCall(socket, nextIdRef, 'Page.enable')
      await cdpCall(socket, nextIdRef, 'Runtime.enable')
      await cdpCall(socket, nextIdRef, 'Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      })
      await cdpCall(socket, nextIdRef, 'Page.navigate', { url })
      await delay(waitMs)
      const actionSummary = await performSourceActions(
        socket,
        nextIdRef,
        source,
        seedQuery,
        preferredAccountText
      )

      const htmlResult = await cdpCall(socket, nextIdRef, 'Runtime.evaluate', {
        expression: 'document.documentElement ? document.documentElement.outerHTML : ""',
        returnByValue: true
      })
      const titleResult = await cdpCall(socket, nextIdRef, 'Runtime.evaluate', {
        expression: 'document.title || ""',
        returnByValue: true
      })
      const screenshotResult = await cdpCall(socket, nextIdRef, 'Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: true
      })

      const html = String(htmlResult.result?.value ?? '')
      await writeFile(htmlOutput, html, 'utf-8')

      let screenshotCreated = false
      if (screenshotResult.data) {
        await writeFile(screenshotOutput, Buffer.from(screenshotResult.data, 'base64'))
        screenshotCreated = true
      }

      return {
        pageTitle: String(titleResult.result?.value ?? '').trim() || null,
        screenshotCreated,
        htmlBytes: Buffer.byteLength(html, 'utf-8'),
        browser: browserCommand,
        actionSummary
      }
    } finally {
      try { socket.close() } catch {}
      try { await fetchJson(`${baseUrl}/json/close/${target.id}`) } catch {}
    }
  } finally {
    await stopBrowserProcess(child)
    if (useIsolatedBackgroundProfile && effectiveUserDataDir) {
      try {
        await rm(effectiveUserDataDir, { recursive: true, force: true })
      } catch {}
    }
  }
}

async function captureKeywordPlannerWithPlaywright({
  browserCommand,
  url,
  htmlOutput,
  screenshotOutput,
  width,
  height,
  waitMs,
  userDataDir,
  source,
  seedQuery,
  preferredAccountText,
  mode
}) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: browserCommand,
    headless: mode === 'background',
    viewport: { width, height },
    args: ['--no-first-run', '--no-default-browser-check', '--new-window']
  })

  const steps = []
  try {
    const page = context.pages()[0] ?? await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(waitMs)

    const bodyText = await page.locator('body').innerText().catch(() => '')
    if (/Select a Google Ads account/i.test(bodyText)) {
      const target = preferredAccountText
        ? page.getByText(preferredAccountText, { exact: false }).first()
        : page.locator('[role="menuitem"], material-list-item').first()
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true })
        steps.push({ step: 'select_account', matched: true, clicked: preferredAccountText || 'first account' })
        await page.waitForTimeout(5000)
      }
    } else {
      steps.push({ step: 'select_account', matched: false })
    }

    const gotItButton = page.getByText('Got it', { exact: true }).first()
    if (await gotItButton.isVisible().catch(() => false)) {
      await gotItButton.click({ force: true })
      steps.push({ step: 'dismiss_modal', clicked: 'Got it' })
      await page.waitForTimeout(1000)
    } else {
      steps.push({ step: 'dismiss_modal', clicked: null })
    }

    const continueButton = page.getByText('Continue', { exact: true }).first()
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click({ force: true })
      steps.push({ step: 'dismiss_disconnect', clicked: 'Continue' })
      await page.waitForTimeout(1000)
    }

    const discoverCard = page.locator('.ideas-card[aria-label="Discover new keywords"], .card-frame[aria-label="Discover new keywords"] [role="button"]').first()
    await discoverCard.waitFor({ state: 'visible', timeout: 15000 })
    await discoverCard.click({ force: true })
    steps.push({ step: 'open_planner_flow', clicked: 'Discover new keywords' })

    await page.locator('text=/Enter products or services closely related to your business/i').first().waitFor({ state: 'visible', timeout: 15000 })
    steps.push({ step: 'wait_for_form', matched: true })

    const keywordInput = page.locator('split-ideas-input-panel .keywords-panel search-chips-selector input.search-input').first()
    await keywordInput.click({ force: true })
    await keywordInput.fill('')

    const seeds = String(seedQuery)
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    const accepted = []
    for (const seed of seeds) {
      await keywordInput.click({ force: true })
      await keywordInput.pressSequentially(seed, { delay: 35 })
      await keywordInput.press('Enter')
      await page.waitForTimeout(700)

      const chipTexts = await page.locator('split-ideas-input-panel .keywords-panel material-chip, split-ideas-input-panel .keywords-panel [role="grid"] material-chip').allInnerTexts().catch(() => [])
      const submitButton = page.locator('split-ideas-input-panel material-button.submit-button').first()
      const submitEnabled = await submitButton.evaluate((node) => {
        return !node.classList.contains('is-disabled') && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true'
      }).catch(() => false)
      const inputValue = await keywordInput.inputValue().catch(() => '')

      accepted.push({
        seed,
        matched: chipTexts.some((text) => text.toLowerCase().includes(seed.toLowerCase())),
        submitEnabled,
        chips: chipTexts,
        inputValue
      })
    }
    steps.push({ step: 'seed_acceptance', items: accepted })

    const submitButton = page.locator('split-ideas-input-panel material-button.submit-button').first()
    const submitEnabled = await submitButton.evaluate((node) => {
      return !node.classList.contains('is-disabled') && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true'
    }).catch(() => false)

    if (submitEnabled) {
      await submitButton.click({ force: true })
      steps.push({ step: 'submit_seed', clicked: 'Get results' })
      await page.waitForTimeout(5000)
    } else {
      steps.push({ step: 'submit_seed', clicked: null })
    }

    const noSuggestions = page.getByText('No suggestions for', { exact: false }).first()
    const resultsToolbar = page.getByText('Add filter', { exact: true }).first()
    const avgMonthly = page.getByText('Avg. monthly searches', { exact: false }).first()
    const resultsMatched = await Promise.race([
      noSuggestions.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'no_suggestions').catch(() => null),
      avgMonthly.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'results_table').catch(() => null),
      resultsToolbar.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'results_toolbar').catch(() => null)
    ])
    steps.push({ step: 'wait_for_results', matched: Boolean(resultsMatched), state: resultsMatched })

    const html = await page.content()
    await writeFile(htmlOutput, html, 'utf-8')
    await page.screenshot({ path: screenshotOutput, fullPage: true })

    return {
      pageTitle: await page.title(),
      screenshotCreated: true,
      htmlBytes: Buffer.byteLength(html, 'utf-8'),
      browser: browserCommand,
      actionSummary: { steps }
    }
  } finally {
    await safeClose(context)
  }
}

async function captureGoogleTrendsWithPlaywright({
  browserCommand,
  url,
  htmlOutput,
  screenshotOutput,
  width,
  height,
  waitMs,
  userDataDir
}) {
  let browser = null
  const context = userDataDir
    ? await chromium.launchPersistentContext(userDataDir, {
        executablePath: browserCommand,
        headless: true,
        viewport: { width, height },
        args: ['--no-first-run', '--no-default-browser-check']
      })
    : await (async () => {
        browser = await chromium.launch({
          executablePath: browserCommand,
          headless: true,
          args: ['--no-first-run', '--no-default-browser-check']
        })
        const browserContext = await browser.newContext({ viewport: { width, height } })
        return browserContext
      })()

  try {
    const page = context.pages()[0] ?? await context.newPage()
    const steps = []

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(waitMs)

    for (const label of ['Accept all', 'I agree', 'Accept', 'Godkänn alla']) {
      const button = page.getByText(label, { exact: true }).first()
      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true }).catch(() => {})
        steps.push({ step: 'dismiss_cookie_banner', clicked: label })
        await page.waitForTimeout(1000)
        break
      }
    }

    await page.waitForTimeout(4000)

    const renderedText = await page.locator('body').innerText().catch(() => '')
    const html = await page.content()
    await writeFile(htmlOutput, html, 'utf-8')
    await page.screenshot({ path: screenshotOutput, fullPage: true })

    return {
      pageTitle: await page.title(),
      screenshotCreated: true,
      htmlBytes: Buffer.byteLength(html, 'utf-8'),
      browser: browserCommand,
      renderedText,
      actionSummary: { steps }
    }
  } finally {
    if (browser) {
      await safeClose(context)
      await safeClose(browser)
    } else {
      await safeClose(context)
    }
  }
}

function deriveWindowsTempLinuxPath(userDataDir) {
  if (!userDataDir) return null
  const marker = '/AppData/Local/'
  const index = userDataDir.indexOf(marker)
  if (index === -1) return null
  return `${userDataDir.slice(0, index)}${marker}Temp`
}

async function main() {
  const args = parseArgs(process.argv)
  const remoteDebuggingUrl = String(args.remoteDebuggingUrl ?? '').trim()
  const browser = remoteDebuggingUrl ? null : detectBrowserCommand(args.browser)
  if (!remoteDebuggingUrl && !browser) {
    throw new Error('No supported local browser command found for search-demand capture. Set OPERATOR_HUB_RESEARCH_BROWSER to a Chromium-compatible binary.')
  }
  const usingWindowsBrowser = browser ? /\.exe$/i.test(browser) : false
  const browserCommand = browser
    ? (usingWindowsBrowser ? await toWindowsPath(browser) : browser)
    : null

  await mkdir(dirname(args.htmlOutput), { recursive: true })
  await mkdir(dirname(args.screenshotOutput), { recursive: true })

  if (remoteDebuggingUrl) {
    const remoteResult = await attachToRemoteBrowser(
      remoteDebuggingUrl,
      args.url,
      args.htmlOutput,
      args.screenshotOutput,
      args.waitMs,
      args.width,
      args.height
    )
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          url: args.url,
          htmlOutput: args.htmlOutput,
          screenshotOutput: args.screenshotOutput,
          width: args.width,
          height: args.height,
          waitMs: args.waitMs,
          browser: remoteResult.browser,
          pageTitle: remoteResult.pageTitle,
          screenshotCreated: remoteResult.screenshotCreated,
          htmlBytes: remoteResult.htmlBytes
        },
        null,
        2
      )}\n`
    )
    return
  }

  if (!usingWindowsBrowser) {
    const localResult = args.source === 'google_keyword_planner'
      ? await captureKeywordPlannerWithPlaywright({
          browserCommand,
          url: args.url,
          htmlOutput: args.htmlOutput,
          screenshotOutput: args.screenshotOutput,
          width: args.width,
          height: args.height,
          waitMs: args.waitMs,
          userDataDir: args.userDataDir,
          source: args.source,
          seedQuery: args.seedQuery,
          preferredAccountText: args.preferredAccountText,
          mode: args.mode
        })
      : args.source === 'google_trends'
        ? await captureGoogleTrendsWithPlaywright({
            browserCommand,
            url: args.url,
            htmlOutput: args.htmlOutput,
            screenshotOutput: args.screenshotOutput,
            width: args.width,
            height: args.height,
            waitMs: args.waitMs,
            userDataDir: args.userDataDir
          })
      : await captureViaLocalBrowserCdp({
          browserCommand,
          url: args.url,
          htmlOutput: args.htmlOutput,
          screenshotOutput: args.screenshotOutput,
          width: args.width,
          height: args.height,
          waitMs: args.waitMs,
          userDataDir: args.userDataDir,
          profileDirectory: args.profileDirectory,
          source: args.source,
          seedQuery: args.seedQuery,
          preferredAccountText: args.preferredAccountText,
          mode: args.mode
        })

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          source: args.source,
          seedQuery: args.seedQuery,
          url: args.url,
          htmlOutput: args.htmlOutput,
          screenshotOutput: args.screenshotOutput,
          width: args.width,
          height: args.height,
          waitMs: args.waitMs,
          browser: localResult.browser,
          pageTitle: localResult.pageTitle,
          screenshotCreated: localResult.screenshotCreated,
          htmlBytes: localResult.htmlBytes,
          renderedText: localResult.renderedText ?? null,
          actionSummary: localResult.actionSummary ?? null
        },
        null,
        2
      )}\n`
    )
    return
  }

  const userDataDir = usingWindowsBrowser && args.userDataDir ? await toWindowsPath(args.userDataDir) : args.userDataDir
  const windowsTempDirLinux = usingWindowsBrowser ? deriveWindowsTempLinuxPath(args.userDataDir) : null
  const screenshotTempLinuxPath = usingWindowsBrowser && windowsTempDirLinux
    ? path.resolve(windowsTempDirLinux, `operator-hub-search-demand-${Date.now()}.png`)
    : args.screenshotOutput
  const screenshotOutput = usingWindowsBrowser ? await toWindowsPath(screenshotTempLinuxPath) : args.screenshotOutput

  const common = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--window-size=${args.width},${args.height}`,
    `--virtual-time-budget=${args.waitMs}`
  ]

  if (userDataDir) {
    common.push(`--user-data-dir=${userDataDir}`)
  }
  if (args.profileDirectory) {
    common.push(`--profile-directory=${args.profileDirectory}`)
  }

  const screenshotArgs = [
    ...common,
    `--screenshot=${screenshotOutput}`,
    args.url
  ]

  const dumpArgs = [
    ...common,
    '--dump-dom',
    args.url
  ]

  const dump = await run(browserCommand, dumpArgs)
  await writeFile(args.htmlOutput, dump.stdout, 'utf-8')
  const htmlSize = Buffer.byteLength(dump.stdout, 'utf-8')
  await run(browserCommand, screenshotArgs)
  if (usingWindowsBrowser && screenshotTempLinuxPath !== args.screenshotOutput && existsSync(screenshotTempLinuxPath)) {
    await copyFile(screenshotTempLinuxPath, args.screenshotOutput)
  }
  const screenshotExists = existsSync(args.screenshotOutput)

  const titleMatch = dump.stdout.match(/<title>([^<]+)<\/title>/i)
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        url: args.url,
        htmlOutput: args.htmlOutput,
        screenshotOutput: args.screenshotOutput,
        width: args.width,
        height: args.height,
        waitMs: args.waitMs,
        browser: browserCommand,
        pageTitle: titleMatch ? titleMatch[1].trim() : null,
        screenshotCreated: screenshotExists,
        htmlBytes: htmlSize
      },
      null,
      2
    )}\n`
  )
}

await main()
