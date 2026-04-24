import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function ShortFormOutro({ outro }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const handle = String(outro?.handle ?? '@sebcastwall')
  const followText = String(outro?.followText ?? 'FÖLJ MIG')
  const accentColor = String(outro?.accentColor ?? '#FFA500')

  // Card slides up + fades in
  const cardProgress = spring({ frame, fps, config: { damping: 18, stiffness: 100, mass: 0.8 } })
  const cardOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const cardY = interpolate(cardProgress, [0, 1], [60, 0])

  // Handle springs in slightly delayed
  const handleScale = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 130, mass: 0.85 } })
  const handleOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Follow text fades in first
  const followOpacity = interpolate(frame, [2, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const cardStyle = {
    backgroundColor: '#06060E',
    border: `3px solid ${accentColor}`,
    borderRadius: 28,
    paddingTop: 52,
    paddingBottom: 52,
    paddingLeft: 72,
    paddingRight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 20,
    width: 880,
    opacity: cardOpacity,
    transform: `translateY(${cardY}px)`,
    boxShadow: `0 0 60px ${accentColor}44, 0 0 120px ${accentColor}22`,
  }

  // Chroma-key green background — ffmpeg keys it out so only the card is visible
  // Card sits in the upper third so it doesn't cover middle-center captions
  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: '#00FF00', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 220 } },
    React.createElement(
      'div',
      { style: cardStyle },
      React.createElement(
        'div',
        {
          style: {
            fontFamily: 'Arial, sans-serif',
            fontWeight: '900',
            fontSize: 56,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: 10,
            textTransform: 'uppercase',
            opacity: followOpacity,
          }
        },
        followText
      ),
      React.createElement(
        'div',
        {
          style: {
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontSize: 96,
            color: accentColor,
            letterSpacing: 1,
            opacity: handleOpacity,
            transform: `scale(${handleScale})`,
            transformOrigin: '50% 50%',
            textShadow: `0 0 30px ${accentColor}cc, 0 0 80px ${accentColor}66`,
          }
        },
        handle
      )
    )
  )
}
