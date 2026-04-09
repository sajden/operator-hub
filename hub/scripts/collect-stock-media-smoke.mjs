import { collectStockMedia } from '../mediaTools.mjs'

const [, , projectSlug = '', selectionsJson = ''] = process.argv

if (!projectSlug.trim() || !selectionsJson.trim()) {
  console.error(
    'Usage: node hub/scripts/collect-stock-media-smoke.mjs <projectSlug> <selections-json>'
  )
  process.exit(1)
}

const selections = JSON.parse(selectionsJson)

const result = await collectStockMedia({
  projectSlug,
  selections
})

console.log(JSON.stringify(result, null, 2))
