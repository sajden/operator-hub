import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { motionTheme } from './motion.mjs'
import { FallbackScene, SCENE_COMPONENTS } from './scenes/index.mjs'

function sceneTimeline(scenes) {
  let cursor = 0
  return (Array.isArray(scenes) ? scenes : []).map((scene, index) => {
    const durationFrames = Math.max(1, Number(scene?.durationFrames ?? 45))
    const normalized = {
      ...scene,
      id: scene?.id ?? `scene-${index + 1}`,
      durationFrames,
      startFrame: cursor,
      endFrame: cursor + durationFrames
    }
    cursor += durationFrames
    return normalized
  })
}

function activeSceneForFrame(timeline, frame) {
  if (timeline.length === 0) return null
  return timeline.find((scene) => frame >= scene.startFrame && frame < scene.endFrame) ?? timeline[timeline.length - 1]
}

export function SiteHeroMotion({ composition, repoRoot, assetUrlMap }) {
  const frame = useCurrentFrame()
  const timeline = sceneTimeline(composition?.scenes ?? [])
  const activeScene = activeSceneForFrame(timeline, frame)
  const theme = motionTheme(composition?.motion?.tone ?? 'operator_tech')
  const SceneComponent = SCENE_COMPONENTS[activeScene?.type] ?? FallbackScene
  const localFrame = activeScene ? frame - activeScene.startFrame : 0

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        background: theme.background,
        color: theme.text,
        fontFamily: 'IBM Plex Sans, sans-serif'
      }
    },
    activeScene
      ? React.createElement(SceneComponent, {
          scene: activeScene,
          localFrame,
          composition,
          repoRoot,
          assetUrlMap,
          theme,
          motion: composition?.motion ?? {}
        })
      : React.createElement(FallbackScene, { scene: { type: 'no_scenes' } }),
    composition?.motion?.cta
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              right: 34,
              bottom: 28,
              padding: '12px 18px',
              borderRadius: 999,
              background: 'rgba(2,6,23,0.42)',
              border: theme.border,
              color: theme.text,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 18,
              letterSpacing: '0.04em'
            }
          },
          composition.motion.cta
        )
      : null
  )
}
