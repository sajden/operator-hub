import { capturePublicProfilePreview } from '../mediaTools.mjs'

const [, , projectSlug = '', approvedUrl = '', label = 'preview', viewportWidthArg = '1440', viewportHeightArg = '900'] = process.argv

if (!projectSlug.trim() || !approvedUrl.trim()) {
  console.error(
    'Usage: node hub/scripts/capture-public-profile-preview-smoke.mjs <projectSlug> <approvedUrl> [label] [viewportWidth] [viewportHeight]'
  )
  process.exit(1)
}

const result = await capturePublicProfilePreview({
  projectSlug,
  approvedUrl,
  label,
  viewportWidth: Number(viewportWidthArg),
  viewportHeight: Number(viewportHeightArg)
})

console.log(JSON.stringify(result, null, 2))
