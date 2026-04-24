import React from 'react'
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion'

export function ShortFormIntroZoom({ introZoom }) {
  const frame = useCurrentFrame()
  const videoSrc = introZoom?.videoSrc ?? null
  const zoomFrames = Math.max(2, Number(introZoom?.zoomFrames ?? 16))
  const startScale = Number(introZoom?.startScale ?? 1.045)
  const endScale = Number(introZoom?.endScale ?? 1)
  const scale = interpolate(frame, [0, zoomFrames], [startScale, endScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        backgroundColor: 'black',
        overflow: 'hidden'
      }
    },
    videoSrc
      ? React.createElement(OffthreadVideo, {
          src: videoSrc,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale})`,
            transformOrigin: '50% 50%'
          }
        })
      : null
  )
}
