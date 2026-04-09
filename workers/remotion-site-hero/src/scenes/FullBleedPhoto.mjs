import React from 'react'
import { AbsoluteFill } from 'remotion'
import { assetToSrc, imageCard, panZoomStyle, sceneEnter, textBlock } from '../motion.mjs'

export function FullBleedPhotoScene({ scene, localFrame, repoRoot, assetUrlMap, theme, motion }) {
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
          inset: 36,
          borderRadius: 38,
          overflow: 'hidden',
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      React.createElement(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            ...panZoomStyle(localFrame, scene.durationFrames, scene.motionStyle)
          }
        },
        imageCard(src)
      ),
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background:
            scene.overlayStyle === 'light_fade'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(15,23,42,0.24) 45%, rgba(2,6,23,0.76) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(2,6,23,0.18) 45%, rgba(2,6,23,0.84) 100%)'
        }
      }),
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            left: 52,
            right: 52,
            bottom: 46,
            display: 'flex',
            justifyContent:
              scene.align === 'center' ? 'center' : scene.align === 'right' ? 'flex-end' : 'flex-start'
          }
        },
        textBlock({
          kicker: scene.kicker,
          headline: scene.headline,
          subheadline: scene.subheadline,
          align: scene.align,
          theme,
          overlayStyle: scene.overlayStyle
        })
      )
    )
  )
}
