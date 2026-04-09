import React from 'react'
import { AbsoluteFill } from 'remotion'
import { sceneEnter, textBlock } from '../motion.mjs'

export function HeadlineOverlayScene({ scene, localFrame, theme, motion }) {
  const enter = sceneEnter(localFrame, motion?.pace)

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background:
          scene.overlayStyle === 'light_fade'
            ? 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(15,23,42,0.8))'
            : 'linear-gradient(135deg, rgba(2,6,23,0.56), rgba(15,23,42,0.92))'
      }
    }),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          padding: '72px 84px',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            scene.align === 'center' ? 'center' : scene.align === 'right' ? 'flex-end' : 'flex-start',
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      textBlock({
        kicker: scene.kicker,
        headline: scene.headline,
        subheadline: scene.subheadline,
        align: scene.align ?? 'center',
        theme,
        overlayStyle: 'soft_panel'
      })
    )
  )
}
