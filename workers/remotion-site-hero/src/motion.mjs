import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function assetToSrc(assetPath, repoRoot, assetUrlMap) {
  if (!assetPath) return null
  if (assetUrlMap?.[assetPath]) return assetUrlMap[assetPath]
  const normalized = String(assetPath).replace(/\\/g, '/')
  return `file://${repoRoot}/${normalized}`
}

export function motionTheme(tone) {
  if (tone === 'clean_premium') {
    return {
      background:
        'radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), linear-gradient(135deg, #0f172a 0%, #111827 52%, #1f2937 100%)',
      panel: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.14)',
      accent: '#fbbf24',
      text: '#f8fafc',
      muted: 'rgba(248,250,252,0.82)'
    }
  }

  if (tone === 'bold_editorial') {
    return {
      background:
        'radial-gradient(circle at top left, rgba(244,63,94,0.18), transparent 32%), linear-gradient(135deg, #020617 0%, #111827 42%, #172033 100%)',
      panel: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.18)',
      accent: '#fb7185',
      text: '#f8fafc',
      muted: 'rgba(248,250,252,0.86)'
    }
  }

  if (tone === 'calm_trust') {
    return {
      background:
        'radial-gradient(circle at top left, rgba(16,185,129,0.16), transparent 32%), linear-gradient(135deg, #082f49 0%, #0f172a 44%, #1e293b 100%)',
      panel: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)',
      accent: '#34d399',
      text: '#f8fafc',
      muted: 'rgba(226,232,240,0.8)'
    }
  }

  return {
    background:
      'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 42%, #111827 100%)',
    panel: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.16)',
    accent: '#60a5fa',
    text: '#f8fafc',
    muted: 'rgba(248,250,252,0.82)'
  }
}

export function sceneEnter(localFrame, pace = 'medium') {
  const { fps } = useVideoConfig()
  const config =
    pace === 'fast'
      ? { damping: 140, stiffness: 180 }
      : pace === 'slow'
        ? { damping: 220, stiffness: 90 }
        : { damping: 180, stiffness: 130 }

  const progress = spring({
    fps,
    frame: localFrame,
    config
  })

  return {
    progress,
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [34, 0]),
    scale: interpolate(progress, [0, 1], [0.96, 1])
  }
}

export function textBlock({ kicker, headline, subheadline, align = 'left', theme, overlayStyle = 'dark_gradient' }) {
  const alignment = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
  const maxWidth = align === 'center' ? 980 : 720
  const overlay =
    overlayStyle === 'soft_panel'
      ? { background: 'rgba(2,6,23,0.42)', border: theme.border, borderRadius: 28, padding: '28px 30px' }
      : {}

  return React.createElement(
    'div',
    {
      style: {
        display: 'grid',
        gap: 14,
        maxWidth,
        textAlign: alignment,
        ...overlay
      }
    },
    kicker
      ? React.createElement(
          'div',
          {
            style: {
              color: theme.accent,
              fontFamily: 'IBM Plex Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: 18
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
              fontWeight: 700,
              lineHeight: 0.98,
              fontSize: 92,
              color: theme.text
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
              fontSize: 28,
              lineHeight: 1.25,
              color: theme.muted
            }
          },
          subheadline
        )
      : null
  )
}

export function imageCard(src, style = {}) {
  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 32,
        width: '100%',
        height: '100%',
        ...style
      }
    },
    src
      ? React.createElement(Img, {
          src,
          style: { width: '100%', height: '100%', objectFit: 'cover' }
        })
      : React.createElement('div', {
          style: {
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.06)'
          }
        })
  )
}

export function panZoomStyle(localFrame, durationFrames, motionStyle = 'steady') {
  const frame = useCurrentFrame()
  const progress = durationFrames > 1 ? Math.min(1, Math.max(0, localFrame / (durationFrames - 1))) : 1
  if (motionStyle === 'drift_left') {
    return {
      transform: `scale(${interpolate(progress, [0, 1], [1.05, 1.12])}) translateX(${interpolate(progress, [0, 1], [0, -40])}px)`
    }
  }
  if (motionStyle === 'drift_right') {
    return {
      transform: `scale(${interpolate(progress, [0, 1], [1.04, 1.1])}) translateX(${interpolate(progress, [0, 1], [0, 40])}px)`
    }
  }
  if (motionStyle === 'slow_push') {
    return {
      transform: `scale(${interpolate(progress, [0, 1], [1.02, 1.1])})`
    }
  }
  return {
    transform: `scale(${interpolate(progress, [0, 1], [1.01, 1.06])}) translateY(${interpolate(frame, [0, durationFrames || 1], [0, -16])}px)`
  }
}
