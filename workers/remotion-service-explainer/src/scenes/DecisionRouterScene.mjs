import React from 'react'
import { AbsoluteFill, interpolate } from 'remotion'
import { sceneEnter, shellFrame } from '../motion.mjs'

const TARGETS = [
  { label: 'CRM', x: 1124, y: 250 },
  { label: 'Mejl', x: 1124, y: 356 },
  { label: 'Excel', x: 1124, y: 462 },
  { label: 'Bokning', x: 1124, y: 568 }
]

function labelPill(text, theme) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex', minHeight: 28, alignItems: 'center', padding: '0 12px', borderRadius: 999,
      background: 'rgba(17,24,39,0.06)', color: theme.accent, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13,
      letterSpacing: '0.08em', textTransform: 'uppercase'
    }
  }, text)
}

function intakeCard(localFrame, theme) {
  return React.createElement('div', {
    style: {
      position: 'absolute', left: 92, top: 374, width: 220, height: 122, borderRadius: 28,
      background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 22px 50px rgba(17,24,39,0.08)',
      padding: '18px 18px', opacity: interpolate(localFrame, [6, 14], [0, 1]), transform: `translateX(${interpolate(localFrame, [6, 14], [-14, 0])}px)`
    }
  },
  React.createElement('div', { style: { color: theme.textOnLight, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: '-0.05em' } }, 'Ett inflöde'),
  React.createElement('div', { style: { marginTop: 8, color: 'rgba(17,24,33,0.68)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 15, lineHeight: 1.3 } }, 'Samma data kommer in en gång.'))
}

function integrationCore(localFrame, theme) {
  return React.createElement('div', {
    style: {
      position: 'absolute', left: 596, top: 284, width: 292, height: 238, borderRadius: 38,
      background: 'linear-gradient(180deg, #111821, #0b1118)', boxShadow: '0 34px 90px rgba(17,24,33,0.18)',
      display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 12, color: theme.textOnDark,
      opacity: interpolate(localFrame, [10, 20], [0, 1]), transform: `scale(${interpolate(localFrame, [10, 20], [0.94, 1])})`
    }
  },
  React.createElement('div', { style: { display: 'inline-flex', minHeight: 28, alignItems: 'center', padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: theme.accent, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' } }, 'Lager'),
  React.createElement('div', { style: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 46, fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 0.92 } }, 'Integration'),
  React.createElement('div', { style: { maxWidth: 200, textAlign: 'center', color: 'rgba(248,245,239,0.74)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 17, lineHeight: 1.3 } }, 'Skickar uppdateringen direkt till rätt system.'))
}

function targetCard(item, i, localFrame, theme) {
  return React.createElement('div', {
    key: item.label,
    style: {
      position: 'absolute', left: item.x, top: item.y, width: 198, height: 78, borderRadius: 22,
      background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 18px 42px rgba(17,24,39,0.08)',
      padding: '14px 16px', opacity: interpolate(localFrame, [16 + i * 2, 26 + i * 2], [0, 1]), transform: `translateX(${interpolate(localFrame, [16 + i * 2, 26 + i * 2], [14, 0])}px)`
    }
  },
  React.createElement('div', { style: { color: theme.textOnLight, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 27, fontWeight: 700, letterSpacing: '-0.05em' } }, item.label),
  React.createElement('div', { style: { marginTop: 6, color: 'rgba(17,24,33,0.64)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13 } }, 'Direkt uppdaterad'))
}

function cleanLine(x, y, width, frameStart, localFrame) {
  return React.createElement('div', {
    key: `${x}-${y}`,
    style: {
      position: 'absolute', left: x, top: y, width, height: 4, borderRadius: 999,
      background: 'linear-gradient(90deg, rgba(122,162,255,0.14), rgba(122,162,255,0.82), rgba(122,162,255,0.14))',
      transformOrigin: '0 50%', transform: `scaleX(${interpolate(localFrame, [frameStart, frameStart + 10], [0.12, 1])})`, opacity: interpolate(localFrame, [frameStart, frameStart + 8], [0, 1])
    }
  })
}

function dataPulse(localFrame) {
  const x = interpolate(localFrame, [22, 46], [312, 1132], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(localFrame, [22, 30, 46], [412, 412, 270], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return React.createElement('div', {
    style: {
      position: 'absolute', left: x, top: y, width: 104, height: 42, borderRadius: 14,
      background: 'linear-gradient(180deg, #7aa2ff, #5d85ef)', color: '#fff', boxShadow: '0 16px 38px rgba(122,162,255,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13, fontWeight: 700,
      opacity: interpolate(localFrame, [20, 28], [0, 1])
    }
  }, 'synkad data')
}

export function DecisionRouterScene({ scene, localFrame, theme, motion }) {
  const entry = sceneEnter(localFrame, motion?.pace ?? 'medium')

  return React.createElement(
    AbsoluteFill,
    { style: shellFrame(theme, 'light') },
    React.createElement(
      'div',
      { style: { position: 'absolute', inset: 0, opacity: entry.opacity, transform: `translateY(${entry.translateY}px) scale(${entry.scale})` } },
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 20%, rgba(122,162,255,0.10), transparent 18%), radial-gradient(circle at 82% 20%, rgba(233,197,141,0.14), transparent 18%)' } }),
      React.createElement('div', {
        style: { position: 'absolute', left: 86, top: 72, width: 400, display: 'grid', gap: 14 }
      },
      labelPill(scene?.kicker || 'Lösning', theme),
      React.createElement('div', { style: { color: theme.textOnLight, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 46, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.05em' } }, 'Ett integrationslager skickar datan rätt direkt.'),
      React.createElement('div', { style: { color: 'rgba(17,24,33,0.72)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 19, lineHeight: 1.35, maxWidth: 360 } }, 'I stället för flera hopp får systemen samma uppdatering direkt.')),
      intakeCard(localFrame, theme),
      integrationCore(localFrame, theme),
      ...TARGETS.map((item, i) => targetCard(item, i, localFrame, theme)),
      cleanLine(312, 428, 294, 14, localFrame),
      ...TARGETS.map((item, i) => cleanLine(888, item.y + 38, 236, 18 + i * 2, localFrame)),
      dataPulse(localFrame)
    )
  )
}
