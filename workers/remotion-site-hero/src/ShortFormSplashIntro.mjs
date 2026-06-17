import React from 'react'
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function ShortFormSplashIntro({ splashIntro }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const speakerSrc = splashIntro?.speakerSrc ?? null
  const articleSrc = splashIntro?.articleSrc ?? null
  const captions = Array.isArray(splashIntro?.captions) ? splashIntro.captions : []
  const headlineText = String(splashIntro?.headlineText ?? 'SENASTE NYTT')
  const accentColor = String(splashIntro?.accentColor ?? '#FFA500')
  const totalFrames = Number(splashIntro?.durationInFrames ?? 90)

  const topH = Math.round(height * 0.45)
  const botH = height - topH
  const halfW = Math.round(width / 2)

  // Ken Burns on speaker
  const speakerScale = interpolate(frame, [0, totalFrames], [1.06, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  })

  // Bottom panel slides up
  const panelSpring = spring({ frame, fps, config: { damping: 22, stiffness: 95, mass: 1.0 } })
  const panelY = interpolate(panelSpring, [0, 1], [botH, 0])

  // Article slides in from left
  const artSpring = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } })
  const artX = interpolate(artSpring, [0, 1], [-80, 0])
  const artOpacity = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Headline slides in from right
  const hdSpring = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 130, mass: 0.8 } })
  const hdX = interpolate(hdSpring, [0, 1], [80, 0])
  const hdOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Watermark fades in
  const wmOpacity = interpolate(frame, [8, 20], [0, 0.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Captions fade in
  const capOpacity = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Fade out last ~12 frames
  const globalOpacity = interpolate(frame, [totalFrames - 12, totalFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  })

  // Find current caption page
  const currentSec = frame / fps
  const currentPage = captions.find(p => currentSec >= p.start && currentSec <= p.end + 0.3) ?? null
  const words = currentPage?.words ?? []

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: '#000', opacity: globalOpacity, overflow: 'hidden' } },

    // ── TOP GRID: Speaker ──────────────────────────────────────────────────
    React.createElement('div', {
      style: { position: 'absolute', top: 0, left: 0, width, height: topH, overflow: 'hidden', backgroundColor: '#0a0a14' }
    },
      // Dark gradient background
      React.createElement('div', {
        style: {
          position: 'absolute', inset: 0,
          background: [
            `radial-gradient(ellipse 70% 60% at 82% 92%, ${accentColor}38 0%, transparent 65%)`,
            'radial-gradient(ellipse 55% 45% at 15% 10%, #6622cc33 0%, transparent 60%)',
            'linear-gradient(160deg, #080814 0%, #0c0a18 50%, #100810 100%)'
          ].join(', ')
        }
      }),

      // @SEBCASTWALL row 1 — white, drifts left
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: '22%', left: 0, width: '220%',
          transform: `translateX(${interpolate(frame, [0, totalFrames], [0, -200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px) rotate(-8deg)`,
          fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: '900',
          fontSize: 90, color: 'white',
          opacity: wmOpacity,
          letterSpacing: 12, textTransform: 'uppercase',
          whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none'
        }
      }, '@SEBCASTWALL   @SEBCASTWALL   @SEBCASTWALL'),

      // @SEBCASTWALL row 2 — orange accent, drifts right
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: '52%', left: '-110%', width: '220%',
          transform: `translateX(${interpolate(frame, [0, totalFrames], [0, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px) rotate(-8deg)`,
          fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: '900',
          fontSize: 90, color: accentColor,
          opacity: wmOpacity * 0.75,
          letterSpacing: 12, textTransform: 'uppercase',
          whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none'
        }
      }, '@SEBCASTWALL   @SEBCASTWALL   @SEBCASTWALL'),

      // Thin orange line above captions
      React.createElement('div', {
        style: {
          position: 'absolute', bottom: 160, left: 40, right: 40, height: 2,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: interpolate(frame, [8, 20], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        }
      }),

      // Speaker video — transparent so background shows through
      // objectPosition 'center bottom' anchors speaker to bottom of grid, transformOrigin bottom keeps zoom centered there
      speakerSrc
        ? String(speakerSrc).startsWith('data:image/')
          ? React.createElement(Img, {
              src: speakerSrc,
              style: {
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'contain',
                objectPosition: 'center bottom'
              }
            })
          : React.createElement(OffthreadVideo, {
              src: speakerSrc,
              transparent: true,
              style: {
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'contain',
                objectPosition: 'center bottom'
              }
            })
        : null,

      // Bottom gradient — blends into dark panel
      React.createElement('div', {
        style: {
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
          background: 'linear-gradient(to bottom, transparent, #06060E)'
        }
      }),

      // Caption bar at bottom of top grid
      words.length > 0
        ? React.createElement('div', {
            style: {
              position: 'absolute',
              bottom: 28,
              left: 0, right: 0,
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              paddingLeft: 48, paddingRight: 48,
              opacity: capOpacity
            }
          },
          ...words.map((w, i) => {
            const isActive = w.start <= currentSec && w.end > currentSec
            return React.createElement('span', {
              key: i,
              style: {
                fontFamily: 'Arial, sans-serif',
                fontWeight: '900',
                fontSize: 38,
                color: isActive ? accentColor : 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                letterSpacing: 0.5,
                display: 'inline-block'
              }
            }, w.word)
          })
        )
        : null
    ),

    // ── BOTTOM PANEL: Article + Headline ───────────────────────────────────
    React.createElement('div', {
      style: {
        position: 'absolute', bottom: 0, left: 0, width, height: botH,
        backgroundColor: '#06060E',
        transform: `translateY(${panelY}px)`,
        display: 'flex', flexDirection: 'row', overflow: 'hidden'
      }
    },
      // Accent top border
      React.createElement('div', {
        style: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: accentColor }
      }),

      // Grid 2: Article screenshot
      React.createElement('div', {
        style: {
          width: halfW, height: '100%', overflow: 'hidden',
          opacity: artOpacity,
          transform: `translateX(${artX}px)`,
          borderRight: `1px solid ${accentColor}40`
        }
      },
        articleSrc
          ? React.createElement(Img, {
              src: articleSrc,
              style: { width: '100%', height: 'auto', objectFit: 'cover', objectPosition: 'top center', minHeight: '100%' }
            })
          : React.createElement('div', { style: { width: '100%', height: '100%', backgroundColor: '#0d0d1a' } })
      ),

      // Grid 3: Label + Headline
      React.createElement('div', {
        style: {
          width: halfW, height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          justifyContent: 'center', padding: '0 36px',
          opacity: hdOpacity, transform: `translateX(${hdX}px)`
        }
      },
        React.createElement('div', {
          style: {
            fontFamily: 'Arial, sans-serif', fontWeight: '700',
            fontSize: 20, color: accentColor,
            letterSpacing: 5, textTransform: 'uppercase', marginBottom: 18
          }
        }, 'SENASTE NYTT'),
        React.createElement('div', {
          style: {
            fontFamily: 'Arial, sans-serif', fontWeight: '900',
            fontSize: 42, color: 'white',
            lineHeight: 1.2, textTransform: 'uppercase',
            letterSpacing: 0.5
          }
        }, headlineText),
        React.createElement('div', {
          style: { marginTop: 20, width: 48, height: 3, backgroundColor: accentColor, borderRadius: 2 }
        })
      )
    )
  )
}
