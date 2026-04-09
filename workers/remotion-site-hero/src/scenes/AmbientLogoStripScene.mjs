import React from 'react'
import { AbsoluteFill } from 'remotion'
import { assetToSrc, imageCard, sceneEnter, textBlock } from '../motion.mjs'

export function AmbientLogoStripScene({ scene, localFrame, repoRoot, assetUrlMap, theme, motion }) {
  const enter = sceneEnter(localFrame, motion?.pace)
  const assets = [scene.primaryAsset, ...(scene.supportingAssets ?? [])]
    .filter(Boolean)
    .slice(0, 5)
    .map((assetPath) => assetToSrc(assetPath, repoRoot, assetUrlMap))

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
          gridTemplateRows: 'auto 1fr',
          gap: 22,
          opacity: enter.opacity,
          transform: `translateY(${enter.translateY}px) scale(${enter.scale})`
        }
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent:
              scene.align === 'center' ? 'center' : scene.align === 'right' ? 'flex-end' : 'flex-start'
          }
        },
        textBlock({
          kicker: scene.kicker,
          headline: scene.headline,
          subheadline: scene.subheadline,
          align: scene.align || 'left',
          theme,
          overlayStyle: 'none'
        })
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(assets.length, 3)}, minmax(0, 1fr))`,
            gap: 16,
            alignItems: 'center'
          }
        },
        ...assets.map((src, index) =>
          React.createElement(
            'div',
            {
              key: `${src}-${index}`,
              style: {
                height: 220,
                borderRadius: 24,
                overflow: 'hidden',
                border: theme.border,
                background: theme.panel
              }
            },
            imageCard(src)
          )
        )
      )
    )
  )
}
