import React from 'react'
import { AbsoluteFill, interpolate } from 'remotion'
import { metricPill, sceneEnter, shellFrame } from '../motion.mjs'

const SYSTEMS = [
  { label: 'CRM', x: 222 },
  { label: 'Mejl', x: 472 },
  { label: 'Excel', x: 722 },
  { label: 'Bokning', x: 972 }
]

function labelPill(text, theme) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex', minHeight: 28, alignItems: 'center', padding: '0 12px', borderRadius: 999,
      background: 'rgba(255,255,255,0.06)', color: theme.accent, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13,
      letterSpacing: '0.08em', textTransform: 'uppercase'
    }
  }, text)
}

function systemChip(item, i, localFrame, theme) {
  return React.createElement('div', {
    key: item.label,
    style: {
      position: 'absolute', left: item.x, top: 328, width: 194, height: 72, borderRadius: 20,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
      padding: '14px 16px', opacity: interpolate(localFrame, [10 + i * 2, 18 + i * 2], [0, 1]), transform: `translateY(${interpolate(localFrame, [10 + i * 2, 18 + i * 2], [8, 0])}px)`
    }
  },
  React.createElement('div', { style: { color: theme.textOnDark, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.05em' } }, item.label),
  React.createElement('div', { style: { marginTop: 6, color: 'rgba(248,245,239,0.68)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13 } }, 'Uppdaterad direkt'))
}

function greenFlow(localFrame) {
  return React.createElement('div', {
    style: {
      position: 'absolute', left: 246, top: 432, width: 856, height: 6, borderRadius: 999,
      background: 'linear-gradient(90deg, rgba(143,214,171,0.16), rgba(143,214,171,0.86), rgba(143,214,171,0.16))',
      transformOrigin: '0 50%', transform: `scaleX(${interpolate(localFrame, [16, 24], [0.12, 1])})`, opacity: interpolate(localFrame, [16, 22], [0, 1])
    }
  })
}

function pulse(localFrame) {
  const x = interpolate(localFrame, [20, 42], [264, 1002], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return React.createElement('div', {
    style: {
      position: 'absolute', left: x, top: 410, width: 132, height: 42, borderRadius: 14,
      background: 'linear-gradient(180deg, #8fd6ab, #69c18c)', color: '#0f1720', boxShadow: '0 18px 40px rgba(143,214,171,0.24)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 14, fontWeight: 800,
      opacity: interpolate(localFrame, [18, 24], [0, 1])
    }
  }, 'går rätt direkt')
}

function outcomeCard(item, i, localFrame, theme) {
  return React.createElement('div', {
    key: item,
    style: {
      borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 16px 14px',
      opacity: interpolate(localFrame, [22 + i * 2, 30 + i * 2], [0, 1]), transform: `translateY(${interpolate(localFrame, [22 + i * 2, 30 + i * 2], [8, 0])}px)`
    }
  },
  React.createElement('div', { style: { width: 10, height: 10, borderRadius: 999, background: theme.success, boxShadow: '0 0 0 6px rgba(143,214,171,0.12)' } }),
  React.createElement('div', { style: { marginTop: 10, color: theme.textOnDark, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08 } }, item))
}

export function OutcomeDashboardScene({ scene, localFrame, theme, motion }) {
  const entry = sceneEnter(localFrame, motion?.pace ?? 'medium')
  const outcomes = Array.isArray(scene?.outcomes) && scene.outcomes.length > 0 ? scene.outcomes : ['Datan hamnar rätt direkt', 'Mindre manuellt arbete', 'Tydligare status']

  return React.createElement(
    AbsoluteFill,
    { style: shellFrame(theme, 'dark') },
    React.createElement(
      'div',
      { style: { position: 'absolute', inset: 0, opacity: entry.opacity, transform: `translateY(${entry.translateY}px) scale(${entry.scale})` } },
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 16%, rgba(122,162,255,0.16), transparent 22%), radial-gradient(circle at 18% 82%, rgba(143,214,171,0.12), transparent 18%)' } }),
      React.createElement('div', { style: { position: 'absolute', left: 86, top: 72, width: 480, display: 'grid', gap: 14 } },
      labelPill(scene?.kicker || 'Efter', theme),
      React.createElement('div', { style: { color: theme.textOnDark, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 46, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.05em' } }, 'Datan hamnar rätt direkt.'),
      React.createElement('div', { style: { color: 'rgba(248,245,239,0.78)', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 19, lineHeight: 1.35, maxWidth: 430 } }, 'Status blir tydligare och färre saker behöver göras för hand.')),
      React.createElement('div', { style: { position: 'absolute', right: 86, top: 82, display: 'flex', gap: 10 } }, metricPill('Mindre manuellt', theme), metricPill('Tydligare status', theme, 'rgba(122,162,255,0.94)')),
      React.createElement('div', { style: { position: 'absolute', left: 86, right: 86, top: 284, bottom: 126, borderRadius: 34, background: 'rgba(10,16,24,0.56)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 74px rgba(0,0,0,0.22)' } }),
      ...SYSTEMS.map((item, i) => systemChip(item, i, localFrame, theme)),
      greenFlow(localFrame),
      pulse(localFrame),
      React.createElement('div', { style: { position: 'absolute', left: 230, right: 230, bottom: 152, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 } },
      ...outcomes.map((item, i) => outcomeCard(item, i, localFrame, theme)))
    )
  )
}
