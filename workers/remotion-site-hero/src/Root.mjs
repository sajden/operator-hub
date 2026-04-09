import React from 'react'
import { Composition, getInputProps } from 'remotion'
import { SiteHeroMotion } from './SiteHeroMotion.mjs'

const input = getInputProps()
const composition = input?.composition ?? {
  title: 'Site hero motion',
  style: 'clean-operator',
  fps: 30,
  width: 1080,
  height: 1080,
  durationInFrames: 240,
  assets: {
    owner: [],
    stock: [],
    previews: []
  },
  scenes: []
}
const repoRoot = input?.repoRoot ?? process.cwd()

export const RemotionRoot = () => {
  return React.createElement(Composition, {
    id: 'SiteHeroMotion',
    component: SiteHeroMotion,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    defaultProps: {
      composition,
      repoRoot
    }
  })
}
