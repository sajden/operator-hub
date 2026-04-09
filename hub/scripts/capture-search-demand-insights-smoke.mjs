import { captureSearchDemandInsights } from '../researchTools.mjs'

const [, , project_slug = '', ...rest] = process.argv

if (!project_slug.trim() || rest.length === 0) {
  console.error(
    'Usage: node hub/scripts/capture-search-demand-insights-smoke.mjs <project_slug> <seed query 1> [seed query 2] ...'
  )
  process.exit(1)
}

const result = await captureSearchDemandInsights({
  project_slug,
  seed_queries: rest,
  sources: ['google_trends']
})

console.log(JSON.stringify(result, null, 2))
