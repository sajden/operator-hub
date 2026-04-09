import React from 'react'
import { Img, interpolate, spring, useVideoConfig } from 'remotion'

export function resolveAssetSrc(assetPath, repoRoot, assetUrlMap) {
  if (!assetPath) return null
  if (assetUrlMap?.[assetPath]) return assetUrlMap[assetPath]
  const normalized = String(assetPath).replace(/\\/g, '/')
  return `file://${repoRoot}/${normalized}`
}

export function explainerTheme(palette = {}) {
  return {
    bgDark: palette.bgDark ?? '#111821',
    bgLight: palette.bgLight ?? '#f6f2ea',
    accent: palette.accent ?? '#e9c58d',
    accentCool: palette.accentCool ?? '#7aa2ff',
    ink: '#0f1720',
    textOnDark: '#f8f5ef',
    textOnLight: '#111821',
    warning: '#ff8d6b',
    success: '#8fd6ab',
    lineMuted: 'rgba(248,245,239,0.25)',
    lineMutedLight: 'rgba(17,24,33,0.14)'
  }
}

export function sceneEnter(localFrame, pace = 'medium') {
  const { fps } = useVideoConfig()
  const config =
    pace === 'fast'
      ? { damping: 140, stiffness: 210 }
      : pace === 'slow'
        ? { damping: 220, stiffness: 100 }
        : { damping: 180, stiffness: 150 }

  const progress = spring({
    fps,
    frame: localFrame,
    config
  })

  return {
    progress,
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [24, 0]),
    scale: interpolate(progress, [0, 1], [0.97, 1])
  }
}

export function shellFrame(theme, mode = 'dark') {
  return {
    position: 'absolute',
    inset: 0,
    background:
      mode === 'light'
        ? `radial-gradient(circle at top right, rgba(122,162,255,0.10), transparent 28%), linear-gradient(145deg, ${theme.bgLight} 0%, #efe7db 100%)`
        : `radial-gradient(circle at top left, rgba(233,197,141,0.12), transparent 26%), linear-gradient(145deg, ${theme.bgDark} 0%, #0b1118 100%)`
  }
}

export function headlineBlock({ kicker, headline, subheadline, theme, align = 'left', onDark = true }) {
  const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
  const color = onDark ? theme.textOnDark : theme.textOnLight
  const subColor = onDark ? 'rgba(248,245,239,0.82)' : 'rgba(17,24,39,0.76)'

  return React.createElement(
    'div',
    {
      style: {
        display: 'grid',
        gap: 12,
        textAlign,
        maxWidth: 760
      }
    },
    kicker
      ? React.createElement(
          'div',
          {
            style: {
              display: 'inline-flex',
              width: 'fit-content',
              minHeight: 30,
              alignItems: 'center',
              padding: '0 12px',
              borderRadius: 999,
              background: onDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)',
              fontFamily: 'IBM Plex Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: 16,
              color: theme.accent
            }
          },
          kicker
        )
      : null,
    headline
      ? React.createElement(
          'div',
          {
            style: {
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: 70,
              lineHeight: 0.96,
              fontWeight: 700,
              letterSpacing: '-0.045em',
              color
            }
          },
          headline
        )
      : null,
    subheadline
      ? React.createElement(
          'div',
          {
            style: {
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: 27,
              lineHeight: 1.25,
              color: subColor,
              maxWidth: 680
            }
          },
          subheadline
        )
      : null
  )
}

export function assetPanel({ src, theme, dark = false, rounded = 28, minHeight = 280 }) {
  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: rounded,
        minHeight,
        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,32,0.08)',
        boxShadow: dark ? '0 28px 80px rgba(0,0,0,0.28)' : '0 28px 80px rgba(17,24,39,0.12)',
        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(17,24,39,0.08)'
      }
    },
    src
      ? React.createElement(Img, {
          src,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }
        })
      : React.createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(145deg, ${theme.accentCool}22 0%, ${theme.accent}10 100%)`
          }
        })
  )
}

export function panelSurface(theme, mode = 'dark') {
  return {
    borderRadius: 32,
    border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(17,24,39,0.08)',
    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)',
    boxShadow: mode === 'dark' ? '0 30px 80px rgba(0,0,0,0.2)' : '0 24px 64px rgba(17,24,39,0.08)'
  }
}

export function pill(label, theme, mode = 'dark') {
  return React.createElement(
    'div',
    {
      style: {
        display: 'inline-flex',
        width: 'fit-content',
        minHeight: 34,
        alignItems: 'center',
        padding: '0 14px',
        borderRadius: 999,
        background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)',
        color: mode === 'dark' ? theme.textOnDark : theme.textOnLight,
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.01em'
      }
    },
    label
  )
}

export function metricPill(label, theme, bg) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'inline-flex',
        width: 'fit-content',
        minHeight: 38,
        alignItems: 'center',
        padding: '0 16px',
        borderRadius: 999,
        background: bg ?? theme.accent,
        color: '#111821',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase'
      }
    },
    label
  )
}
