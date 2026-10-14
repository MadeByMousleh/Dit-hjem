import { randomBytes } from 'node:crypto';
import { ThirdPartyError, authorizationForCustomerKey } from './eloverblik-third-party.mjs';

// Observed in ElOverblik's public GenerateLinkDialog on 2026-10-08.
// No portal-session API request is necessary to construct this URL.
const allowedPaths = new Set(['/power-of-attorney', '/Authorization/authorization', '/authorization/authorization']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function buildAuthorizationLink(template, customerKey, returnUrl, now = Date.now()) {
  let source;
  try { source = new URL(template); } catch { throw new ThirdPartyError(503, 'Eloverblik-fuldmagtslink mangler eller er ugyldigt.'); }
  if (source.origin !== 'https://eloverblik.dk' || source.username || source.password || source.hash || !allowedPaths.has(source.pathname)) {
    throw new ThirdPartyError(503, 'Eloverblik-fuldmagtslinkets adresse er ugyldig.');
  }
  for (const name of ['thirdPartyId', 'fromDate', 'toDate', 'customerKey', 'returnUrl']) {
    if (source.searchParams.getAll(name).length > 1) throw new ThirdPartyError(503, 'Fuldmagtslinket indeholder gentagne parametre.');
  }
  const thirdPartyId = source.searchParams.get('thirdPartyId');
  const fromDate = source.searchParams.get('fromDate'), toDate = source.searchParams.get('toDate');
  if (!thirdPartyId || !uuid.test(thirdPartyId) || !validDate(fromDate) || !validDate(toDate) || fromDate >= toDate || Date.parse(toDate) <= now) {
    throw new ThirdPartyError(503, 'Fuldmagtslinkets virksomhed eller datoer er ugyldige. Opret et nyt link i Eloverblik.');
  }
  if (typeof customerKey !== 'string' || !/^[a-f0-9]{64}$/.test(customerKey)) throw new ThirdPartyError(400, 'Ugyldig forbindelsesnøgle.');
  const link = new URL('https://eloverblik.dk/power-of-attorney');
  link.search = new URLSearchParams({ thirdPartyId, fromDate, toDate, customerKey }).toString();
  // Optional; must come from trusted server config, never from browser input.
  // ElOverblik independently checks this against the registered company domain.
  if (returnUrl) {
    let target;
    try { target = new URL(returnUrl); } catch { throw new ThirdPartyError(503, 'Ugyldig returadresse.'); }
    if (target.protocol !== 'https:' || target.username || target.password || target.hash) throw new ThirdPartyError(503, 'Ugyldig returadresse.');
    link.searchParams.set('returnUrl', target.toString());
  }
  return link.toString();
}

// The authenticated route must obtain these IDs from verified session + membership.
// Persist attempt BEFORE returning its URL. Never log the key or URL.
export function createAuthorizationAttempt({ userId, householdId, platform }, env = process.env, now = Date.now()) {
  if (!uuid.test(userId ?? '') || !uuid.test(householdId ?? '')) throw new ThirdPartyError(400, 'Ugyldig bruger eller husstand.');
  const customerKey = randomBytes(32).toString('hex');
  const template = env.EL_OVERBLIK_AUTH_LINK ?? env.ELOVERBLIK_AUTHORIZATION_URL;
  // Use only trusted configuration for the HTTPS landing page. Eloverblik
  // validates its domain against the company's registered website.
  let configuredReturn = env.ELOVERBLIK_RETURN_URL;
  if (!configuredReturn) {
    try { configuredReturn = new URL(template).searchParams.get('returnUrl'); } catch { /* Validated below. */ }
  }
  const returnUrl = new URL(configuredReturn || 'https://huslyg.dk/eloverblik/return.html');
  // Older configuration pointed at the home page, which never opened the app.
  // Preserve its registered origin but always use the implemented landing page.
  returnUrl.pathname = '/eloverblik/return.html';
  returnUrl.search = '';
  if (platform === 'android' || platform === 'ios') returnUrl.searchParams.set('app', '1');
  else returnUrl.searchParams.delete('app');
  const authorizationUrl = buildAuthorizationLink(template, customerKey, returnUrl.toString(), now);
  return {
    attempt: { userId, householdId, customerKey, createdAt: now, expiresAt: now + 30 * 60_000 },
    authorizationUrl,
  };
}

// Pure verification step for a server-loaded attempt; this does NOT persist or
// activate a connection. The eventual route must atomically consume the attempt
// and uniquely bind the returned authorizationId, scoped to this user/household.
export async function verifyAuthorizationAttempt(attempt, { userId, householdId }, env = process.env, dependencies = {}) {
  const now = dependencies.now ?? Date.now();
  if (!attempt || attempt.userId !== userId || attempt.householdId !== householdId) throw new ThirdPartyError(403, 'Ingen adgang til forbindelsen.');
  if (!Number.isFinite(attempt.expiresAt) || attempt.expiresAt <= now) throw new ThirdPartyError(410, 'Forbindelsesforsøget er udløbet. Start igen.');
  const authorization = await authorizationForCustomerKey(attempt.customerKey, env, dependencies);
  return authorization ? { status: 'verified', authorizationId: authorization.authorizationId } : { status: 'pending' };
}
