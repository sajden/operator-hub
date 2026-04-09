import React from 'react'
import { AbsoluteFill } from 'remotion'
import { assetToSrc, imageCard, panZoomStyle, sceneEnter, textBlock } from '../motion.mjs'

export function DeviceFocusScene({ scene, localFrame, repoRoot, assetUrlMap, theme, motion }) {
  const enter = sceneEnter(localFrame, motion?.pace)
  const primarySrc = assetToSrc(scene.primaryAsset, repoRoot, assetUrlMap)
  const support = (scene.supportingAssets ?? []).slice(0, 2).map((assetPath) => assetToSrc(assetPath, repoRoot, assetUrlMap))

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 44,
          display: 'grid',
          gridTemplateColumns: '0.72fr 1.28fr',
          gap: 24,
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            borderRadius: 30,
            background: theme.panel,
            border: theme.border,
            padding: '34px 30px'
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
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: support.length > 0 ? '1.22fr 0.78fr' : '1fr',
            gap: 16
          }
        },
        React.createElement(
          'div',
          {
            style: {
              borderRadius: 32,
              overflow: 'hidden',
              border: theme.border,
              boxShadow: '0 28px 80px rgba(2,6,23,0.28)'
            }
          },
          React.createElement(
            'div',
            {
              style: {
                width: '100%',
                height: '100%',
                ...panZoomStyle(localFrame, scene.durationFrames, scene.motionStyle || 'drift_left')
              }
            },
            imageCard(primarySrc)
          )
        ),
        support.length > 0
          ? React.createElement(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateRows: `repeat(${support.length}, minmax(0, 1fr))`,
                  gap: 14
                }
              },
              ...support.map((src, index) =>
                React.createElement(
                  'div',
                  {
                    key: `${src}-${index}`,
                    style: {
                      borderRadius: 22,
                      overflow: 'hidden',
                      border: theme.border
                    }
                  },
                  imageCard(src)
                )
              )
            )
          : null
      )
    )
  )
}
