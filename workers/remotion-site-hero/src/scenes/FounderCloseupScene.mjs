import React from 'react'
import { AbsoluteFill } from 'remotion'
import { assetToSrc, imageCard, panZoomStyle, sceneEnter, textBlock } from '../motion.mjs'

export function FounderCloseupScene({ scene, localFrame, repoRoot, assetUrlMap, theme, motion }) {
  const enter = sceneEnter(localFrame, motion?.pace)
  const src = assetToSrc(scene.primaryAsset, repoRoot, assetUrlMap)

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 42,
          display: 'grid',
          gridTemplateColumns: scene.align === 'right' ? '0.84fr 1.16fr' : '1.16fr 0.84fr',
          gap: 24,
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      React.createElement(
        'div',
        {
          style: {
            position: 'relative',
            borderRadius: 36,
            overflow: 'hidden',
            border: theme.border
          }
        },
        React.createElement(
          'div',
          {
            style: {
              width: '100%',
              height: '100%',
              ...panZoomStyle(localFrame, scene.durationFrames, scene.motionStyle || 'slow_push')
            }
          },
          imageCard(src)
        ),
        React.createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 12%, rgba(2,6,23,0.72) 100%)'
          }
        })
      ),
      React.createElement(
        'div',
        {
          style: {
            borderRadius: 32,
            background: theme.panel,
            border: theme.border,
            padding: '42px 38px',
            display: 'flex',
            alignItems: 'center'
          }
        },
        textBlock({
          kicker: scene.kicker,
          headline: scene.headline,
          subheadline: scene.subheadline,
          align: 'left',
          theme,
          overlayStyle: 'none'
        })
      )
    )
  )
}
