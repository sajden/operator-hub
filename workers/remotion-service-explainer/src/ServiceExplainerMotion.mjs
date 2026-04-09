import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { explainerTheme } from './motion.mjs'
import { FallbackScene, SCENE_COMPONENTS } from './scenes/index.mjs'

function sceneTimeline(scenes) {
  let cursor = 0
  return (Array.isArray(scenes) ? scenes : []).map((scene, index) => {
    const durationFrames = Math.max(1, Number(scene?.durationFrames ?? 60))
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

export function ServiceExplainerMotion({ composition, repoRoot, assetUrlMap }) {
  const frame = useCurrentFrame()
  const timeline = sceneTimeline(composition?.scenes ?? [])
  const activeScene = activeSceneForFrame(timeline, frame)
  const theme = explainerTheme(composition?.palette ?? {})
  const SceneComponent = SCENE_COMPONENTS[activeScene?.type] ?? FallbackScene
  const localFrame = activeScene ? frame - activeScene.startFrame : 0

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        background: theme.bgDark,
        color: theme.textOnDark,
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
          motion: {
            pace: composition?.pace ?? 'medium'
          }
        })
      : React.createElement(FallbackScene, { scene: { type: 'no_scenes' } })
  )
}
