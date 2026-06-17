import * as findNewsArticle from './findNewsArticle.mjs'
import * as generateSocialCopy from './generateSocialCopy.mjs'

export const agents = [findNewsArticle, generateSocialCopy]

export function getAgent(id) {
  return agents.find(a => a.meta.id === id) ?? null
}
