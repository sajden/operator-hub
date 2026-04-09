import React from 'react'
import { Composition, getInputProps } from 'remotion'
import { ServiceExplainerMotion } from './ServiceExplainerMotion.mjs'

const input = getInputProps()
const composition = input?.composition ?? {
  title: 'Service explainer motion',
  fps: 30,
  width: 1600,
  height: 900,
  durationInFrames: 300,
  mode: 'three_step_process',
  palette: {},
  assets: {
    owner: [],
    stock: []
  },
  scenes: []
}
const repoRoot = input?.repoRoot ?? process.cwd()
const assetUrlMap = input?.assetUrlMap ?? {}

export const RemotionRoot = () =>
  React.createElement(Composition, {
    id: 'ServiceExplainerMotion',
    component: ServiceExplainerMotion,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    defaultProps: {
      composition,
      repoRoot,
      assetUrlMap
    }
  })
