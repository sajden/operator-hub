import React from 'react'
import { AbsoluteFill } from 'remotion'
import { assetToSrc, imageCard, panZoomStyle, sceneEnter, textBlock } from '../motion.mjs'

export function SplitProductScene({ scene, localFrame, repoRoot, assetUrlMap, theme, motion }) {
  const enter = sceneEnter(localFrame, motion?.pace)
  const primarySrc = assetToSrc(scene.primaryAsset, repoRoot, assetUrlMap)
  const supportSrc = assetToSrc(scene.supportingAssets?.[0] ?? null, repoRoot, assetUrlMap)

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
          gridTemplateColumns: scene.align === 'right' ? '1.08fr 0.92fr' : '0.92fr 1.08fr',
          gap: 26,
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      React.createElement(
        'div',
        {
          style: {
            borderRadius: 36,
            background: theme.panel,
            border: theme.border,
            padding: '44px 40px',
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
      ),
      React.createElement(
        'div',
        {
          style: {
            position: 'relative',
            display: 'grid',
            gridTemplateRows: supportSrc ? '1fr 0.52fr' : '1fr',
            gap: 18
          }
        },
        React.createElement(
          'div',
          {
            style: {
              borderRadius: 34,
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
                ...panZoomStyle(localFrame, scene.durationFrames, scene.motionStyle ?? 'slow_push')
              }
            },
            imageCard(primarySrc)
          )
        ),
        supportSrc
          ? React.createElement(
              'div',
              {
                style: {
                  borderRadius: 26,
                  overflow: 'hidden',
                  border: theme.border
                }
              },
              imageCard(supportSrc)
            )
          : null
      )
    )
  )
}
