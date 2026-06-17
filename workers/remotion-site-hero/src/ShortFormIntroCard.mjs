import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function ShortFormIntroCard({ introCard }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const hookText = String(introCard?.hookText ?? 'STANNAR DU?')
  const subText = String(introCard?.subText ?? 'SE DETTA TILL SLUTET')
  const accentColor = String(introCard?.accentColor ?? '#FFA500')

  // Card slides up from off-screen bottom
  const cardSpring = spring({ frame, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } })
  const cardY = interpolate(cardSpring, [0, 1], [300, 0])
  const cardOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Sub-text fades in slightly after
  const subOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Pulse on accent line
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1], [0.7, 1.0]
  )

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: '#00FF00', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 180 } },
    React.createElement(
      'div',
      {
        style: {
          backgroundColor: '#06060E',
          border: `3px solid ${accentColor}`,
          borderRadius: 24,
          paddingTop: 36,
          paddingBottom: 36,
          paddingLeft: 56,
          paddingRight: 56,
          width: 900,
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          boxShadow: `0 0 50px ${accentColor}55, 0 0 100px ${accentColor}22`,
        }
      },
      // Accent bar
      React.createElement('div', {
        style: {
          width: 60,
          height: 4,
          backgroundColor: accentColor,
          borderRadius: 2,
          opacity: pulse,
          marginBottom: 4,
        }
      }),
      // Hook text
      React.createElement('div', {
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '900',
          fontSize: 64,
          color: 'white',
          letterSpacing: 3,
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: 1.1,
        }
      }, hookText),
      // Sub text
      React.createElement('div', {
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '600',
          fontSize: 30,
          color: accentColor,
          letterSpacing: 4,
          textTransform: 'uppercase',
          opacity: subOpacity,
        }
      }, subText)
    )
  )
}
