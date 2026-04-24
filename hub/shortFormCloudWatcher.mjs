import {
  getShortFormWatchersStatus,
  saveShortFormWatchersStatus
} from './shortFormVideoTools.mjs'

const INPUT_PATH = process.env.OPERATOR_HUB_SHORT_FORM_CLOUD_INPUT_PATH ?? 'Seb/Videos/no-bg-videos'
const OUTPUT_PATH = process.env.OPERATOR_HUB_SHORT_FORM_CLOUD_OUTPUT_PATH ?? 'Seb/Videos/short-form-review-cuts'

export function startShortFormCloudWatcher() {
  void getShortFormWatchersStatus()
    .then((state) => {
      state.cloudWatcher = state.cloudWatcher ?? {
        inputPath: INPUT_PATH,
        outputPath: OUTPUT_PATH,
        jobs: []
      }
      return saveShortFormWatchersStatus(state)
    })
    .catch((error) => {
      console.error('[short-form-cloud-watcher] init failed:', error.message)
    })

  console.log(`Short-form cloud watcher configured: ${INPUT_PATH} → ${OUTPUT_PATH}`)
}
