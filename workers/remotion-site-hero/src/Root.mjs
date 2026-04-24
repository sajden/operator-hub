import React from 'react'
import { Composition, getInputProps } from 'remotion'
import { SiteHeroMotion } from './SiteHeroMotion.mjs'
import { ShortFormIntroZoom } from './ShortFormIntroZoom.mjs'
import { ShortFormOutro } from './ShortFormOutro.mjs'
import { ShortFormIntroCard } from './ShortFormIntroCard.mjs'
import { ShortFormSplashIntro } from './ShortFormSplashIntro.mjs'

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
const repoRoot = input?.repoRoot ?? ''
const outro = input?.outro ?? {
  handle: '@sebcastwall',
  followText: 'FÖLJ MIG',
  bgColor: '#0d0d0d',
  accentColor: '#FFA500',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 90
}
const introZoom = input?.introZoom ?? {
  title: 'Short-form intro zoom',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 90,
  videoSrc: null
}
const splashIntro = input?.splashIntro ?? {
  speakerSrc: null,
  articleSrc: null,
  headlineText: 'SENASTE NYTT',
  accentColor: '#FFA500',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 90
}
const introCard = input?.introCard ?? {
  hookText: 'STANNAR DU?',
  subText: 'SE DETTA TILL SLUTET',
  accentColor: '#FFA500',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 75
}

export const RemotionRoot = () => {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
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
    }),
    React.createElement(Composition, {
      id: 'ShortFormOutro',
      component: ShortFormOutro,
      durationInFrames: outro.durationInFrames,
      fps: outro.fps,
      width: outro.width,
      height: outro.height,
      defaultProps: { outro }
    }),
    React.createElement(Composition, {
      id: 'ShortFormIntroZoom',
      component: ShortFormIntroZoom,
      durationInFrames: introZoom.durationInFrames,
      fps: introZoom.fps,
      width: introZoom.width,
      height: introZoom.height,
      defaultProps: { introZoom }
    }),
    React.createElement(Composition, {
      id: 'ShortFormSplashIntro',
      component: ShortFormSplashIntro,
      durationInFrames: splashIntro.durationInFrames,
      fps: splashIntro.fps,
      width: splashIntro.width,
      height: splashIntro.height,
      defaultProps: { splashIntro }
    }),
    React.createElement(Composition, {
      id: 'ShortFormIntroCard',
      component: ShortFormIntroCard,
      durationInFrames: introCard.durationInFrames,
      fps: introCard.fps,
      width: introCard.width,
      height: introCard.height,
      defaultProps: { introCard }
    })
  )
}
