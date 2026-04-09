import React from 'react'
import { AbsoluteFill } from 'remotion'
import { DecisionRouterScene } from './DecisionRouterScene.mjs'
import { OutcomeDashboardScene } from './OutcomeDashboardScene.mjs'
import { ProblemFlowScene } from './ProblemFlowScene.mjs'

export const SCENE_COMPONENTS = {
  problem_flow: ProblemFlowScene,
  decision_router: DecisionRouterScene,
  outcome_dashboard: OutcomeDashboardScene
}

export function FallbackScene({ scene }) {
  return React.createElement(
    AbsoluteFill,
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 40,
        color: '#f8f5ef',
        background: '#111821'
      }
    },
    `Unknown scene: ${scene?.type ?? 'missing'}`
  )
}
