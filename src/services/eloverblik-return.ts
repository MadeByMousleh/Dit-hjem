// Navigation hint only. Approval is always checked with the authenticated API.
export function isEloverblikReturnUrl(url: string) {
  // RN's built-in URL hostname/path getters only support HTTP(S), not custom
  // schemes. Match our exact navigation destinations without that dependency.
  return /^(?:stromblik:\/\/eloverblik\/connected|https:\/\/(?:huslyg\.dk|dit-hjem-five\.vercel\.app)\/eloverblik\/return\.html)(?:[?#]|$)/.test(url);
}
