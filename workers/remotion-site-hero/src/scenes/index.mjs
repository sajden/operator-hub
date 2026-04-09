import React from 'react'
import { AbsoluteFill } from 'remotion'
import { AmbientLogoStripScene } from './AmbientLogoStripScene.mjs'
import { DeviceFocusScene } from './DeviceFocusScene.mjs'
import { FounderCloseupScene } from './FounderCloseupScene.mjs'
import { FullBleedPhotoScene } from './FullBleedPhoto.mjs'
import { HeadlineOverlayScene } from './HeadlineOverlayScene.mjs'
import { ProofGridScene } from './ProofGridScene.mjs'
import { SplitProductScene } from './SplitProductScene.mjs'

export const SCENE_COMPONENTS = {
  full_bleed_photo: FullBleedPhotoScene,
  founder_closeup: FounderCloseupScene,
  device_focus: DeviceFocusScene,
  split_product: SplitProductScene,
  headline_overlay: HeadlineOverlayScene,
  proof_grid: ProofGridScene,
  ambient_logo_strip: AmbientLogoStripScene
}

export function FallbackScene({ scene }) {
  return React.createElement(
    AbsoluteFill,
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f8fafc',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 42
      }
    },
    `Unknown scene: ${scene?.type ?? 'missing'}`
  )
}
