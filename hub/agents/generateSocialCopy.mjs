/**
 * Agent: generateSocialCopy
 * Thin HTTP client — delegates to social-copy-api service.
 */

export const meta = {
  id: 'generateSocialCopy',
  name: 'Generate Social Copy',
  description: 'Generates platform-specific social media copy by calling the social-copy-api service.',
  inputSchema: {
    transcript: { type: 'string', description: 'Full transcript text from the video' },
    topic: { type: 'string', description: 'Optional topic hint' }
  },
  outputSchema: {
    platforms: { type: 'object' },
    commonComment: { type: 'string' },
    markdown: { type: 'string' }
  }
}

const SOCIAL_COPY_API_URL = process.env.SOCIAL_COPY_API_URL ?? 'http://social-copy-api:3410'

export async function run({ transcript, topic = '' }) {
  if (!transcript || transcript.trim().length < 20) {
    return { platforms: {}, commonComment: '', markdown: '', reason: 'Transcript too short' }
  }

  try {
    const resp = await fetch(`${SOCIAL_COPY_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, topic }),
      signal: AbortSignal.timeout(90000)
    })
    if (!resp.ok) throw new Error(`social-copy-api ${resp.status}: ${await resp.text()}`)
    return await resp.json()
  } catch (err) {
    return { platforms: {}, commonComment: '', markdown: '', reason: `social-copy-api error: ${err.message.slice(0, 200)}` }
  }
}
