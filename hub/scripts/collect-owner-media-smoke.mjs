import { collectOwnerMedia } from '../mediaTools.mjs'

const [
  ,
  ,
  projectSlug = 'smoke-owner-media',
  assetTypesArg = 'profile',
  urlsArg = '',
  localPathsArg = '',
  maxAssetsArg = '2'
] = process.argv

const approvedUrls = urlsArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const approvedLocalPaths = localPathsArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (approvedUrls.length === 0 && approvedLocalPaths.length === 0) {
  console.error(
    'Usage: node hub/scripts/collect-owner-media-smoke.mjs <projectSlug> <comma-separated-asset-types> [comma-separated-approved-urls] [comma-separated-approved-local-paths] [maxAssets]'
  )
  process.exit(1)
}

const assetTypes = assetTypesArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const result = await collectOwnerMedia({
  projectSlug,
  approvedUrls,
  approvedLocalPaths,
  assetTypes,
  maxAssets: Number(maxAssetsArg)
})

console.log(JSON.stringify(result, null, 2))
