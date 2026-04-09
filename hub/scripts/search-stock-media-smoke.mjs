import { searchStockMedia } from '../mediaTools.mjs'

const [
  ,
  ,
  query = '',
  providersArg = 'pexels,unsplash',
  orientation = 'landscape',
  maxResultsArg = '8'
] = process.argv

if (!query.trim()) {
  console.error(
    'Usage: node hub/scripts/search-stock-media-smoke.mjs <query> [comma-separated-providers] [orientation] [maxResults]'
  )
  process.exit(1)
}

const providers = providersArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const result = await searchStockMedia({
  query,
  providers,
  orientation,
  maxResults: Number(maxResultsArg)
})

console.log(JSON.stringify(result, null, 2))
