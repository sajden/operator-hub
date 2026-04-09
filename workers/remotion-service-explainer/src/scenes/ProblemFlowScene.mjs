import React from 'react'
import { AbsoluteFill, interpolate } from 'remotion'
import { sceneEnter, shellFrame } from '../motion.mjs'

const STOPS = [
  { label: 'CRM', x: 210 },
  { label: 'Mejl', x: 460 },
  { label: 'Excel', x: 710 },
  { label: 'Bokning', x: 960 }
]

function labelPill(text, theme) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex',
      minHeight: 28,
      alignItems: 'center',
      padding: '0 12px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.06)',
      color: theme.accent,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, text)
}

function stopLabel(stop, i, localFrame, theme) {
  return React.createElement('div', {
    key: stop.label,
    style: {
      position: 'absolute',
      left: stop.x - 52,
      top: 302,
      width: 104,
      textAlign: 'center',
      opacity: interpolate(localFrame, [4 + i * 2, 12 + i * 2], [0, 1]),
      transform: `translateY(${interpolate(localFrame, [4 + i * 2, 12 + i * 2], [8, 0])}px)`
    }
  },
  React.createElement('div', {
    style: {
      color: theme.textOnDark,
      fontFamily: 'IBM Plex Sans, sans-serif',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.04em'
    }
  }, stop.label),
  React.createElement('div', {
    style: {
      marginTop: 5,
      color: 'rgba(248,245,239,0.52)',
      fontFamily: 'IBM Plex Sans, sans-serif',
      fontSize: 12
    }
  }, 'Eget steg'))
}

function stopNode(stop, i, localFrame, theme) {
  return React.createElement('div', {
    key: `${stop.label}-node`,
    style: {
      position: 'absolute',
      left: stop.x - 18,
      top: 392,
      width: 36,
      height: 36,
      borderRadius: 999,
      background: 'linear-gradient(180deg, #ff9f82, #ff845f)',
      boxShadow: '0 0 0 14px rgba(255,141,107,0.12), 0 18px 44px rgba(0,0,0,0.22)',
      opacity: interpolate(localFrame, [6 + i * 2, 14 + i * 2], [0, 1]),
      transform: `scale(${interpolate(localFrame, [6 + i * 2, 14 + i * 2], [0.86, 1])})`
    }
  })
}

function dashedRail(localFrame) {
  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: 210,
      width: 750,
      top: 408,
      height: 4,
      borderTop: '4px dashed rgba(255,141,107,0.56)',
      transformOrigin: '0 50%',
      transform: `scaleX(${interpolate(localFrame, [8, 18], [0.12, 1])})`,
      opacity: interpolate(localFrame, [8, 16], [0, 1])
    }
  })
}

function packet(localFrame) {
  const x = interpolate(localFrame, [18, 40], [232, 912], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = interpolate(localFrame, [18, 26, 40], [0.94, 1, 0.98], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        left: x,
        top: 366,
        width: 124,
        height: 84,
        display: 'grid',
        justifyItems: 'center',
        alignContent: 'center',
        opacity: interpolate(localFrame, [16, 22], [0, 1]),
        transform: `scale(${pulse})`
      }
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: 84,
        height: 84,
        borderRadius: 999,
        background: 'radial-gradient(circle, rgba(255,226,212,0.34), rgba(255,226,212,0))'
      }
    }),
    React.createElement('div', {
      style: {
        position: 'relative',
        width: 112,
        height: 44,
        borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(255,250,246,0.98), rgba(245,229,223,0.98))',
        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
        color: '#7b4030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '-0.01em'
      }
    }, 'kunddata')
  )
}

function frictionNote(text, x, localFrame, frameStart) {
  return React.createElement('div', {
    key: text,
    style: {
      position: 'absolute',
      left: x,
      top: 456,
      display: 'inline-flex',
      minHeight: 34,
      alignItems: 'center',
      padding: '0 14px',
      borderRadius: 999,
      background: 'rgba(255,141,107,0.10)',
      border: '1px solid rgba(255,141,107,0.18)',
      color: '#ffc3b5',
      fontFamily: 'IBM Plex Sans, sans-serif',
      fontSize: 13,
      fontWeight: 700,
      opacity: interpolate(localFrame, [frameStart, frameStart + 8], [0, 1]),
      transform: `translateY(${interpolate(localFrame, [frameStart, frameStart + 10], [8, 0])}px)`
    }
  }, text)
}

export function ProblemFlowScene({ scene, localFrame, theme, motion }) {
  const entry = sceneEnter(localFrame, motion?.pace ?? 'medium')

  return React.createElement(
    AbsoluteFill,
    { style: shellFrame(theme, 'dark') },
    React.createElement(
      'div',
      { style: { position: 'absolute', inset: 0, opacity: entry.opacity, transform: `translateY(${entry.translateY}px) scale(${entry.scale})` } },
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 82% 18%, rgba(255,141,107,0.10), transparent 18%), radial-gradient(circle at 18% 82%, rgba(122,162,255,0.08), transparent 18%)'
        }
      }),
      React.createElement('div', {
        style: { position: 'absolute', left: 86, top: 72, width: 380, display: 'grid', gap: 14 }
      },
      labelPill(scene?.kicker || 'Före', theme),
      React.createElement('div', {
        style: {
          color: theme.textOnDark,
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: 42,
          lineHeight: 0.98,
          fontWeight: 700,
          letterSpacing: '-0.05em'
        }
      }, 'Datan fastnar i flera manuella stopp.'),
      React.createElement('div', {
        style: {
          color: 'rgba(248,245,239,0.74)',
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: 18,
          lineHeight: 1.35,
          maxWidth: 350
        }
      }, 'Varje steg kräver att någon mejlar, kopierar eller kontrollerar vidare.')),
      dashedRail(localFrame),
      packet(localFrame),
      ...STOPS.map((stop, i) => stopLabel(stop, i, localFrame, theme)),
      ...STOPS.map((stop, i) => stopNode(stop, i, localFrame, theme)),
      frictionNote('Mejlas över', 314, localFrame, 18),
      frictionNote('Kopieras vidare', 566, localFrame, 20),
      frictionNote('Kontrolleras', 826, localFrame, 22),
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: 86,
          right: 86,
          bottom: 86,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12
        }
      },
      ['Status missas', 'Samma data skrivs in igen', 'Onödiga steg i varje led'].map((item, i) =>
        React.createElement('div', {
          key: item,
          style: {
            padding: '14px 16px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(248,245,239,0.72)',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            opacity: interpolate(localFrame, [24 + i * 2, 32 + i * 2], [0, 1]),
            transform: `translateY(${interpolate(localFrame, [24 + i * 2, 32 + i * 2], [8, 0])}px)`
          }
        }, item)
      ))
    )
  )
}
