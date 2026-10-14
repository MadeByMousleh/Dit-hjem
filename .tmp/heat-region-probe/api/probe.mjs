import { resolve4, resolve6 } from 'node:dns/promises';

// Fixed, synthetic-only diagnostic. No user input, login or response token output.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const result = { region: process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? 'unknown', node: process.version };
  for (const [key, resolve] of [['ipv4', resolve4], ['ipv6', resolve6]]) {
    try { result[key] = await resolve('apiapp.dff-edb.dk'); }
    catch (error) { result[key] = ['ENODATA', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code) ? error.code : 'DNS_ERROR'; }
  }
  const started = Date.now();
  try {
    const response = await fetch('https://apiapp.dff-edb.dk/sdbg/system/getsecuritytoken/project/app/consumer/0', {
      redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Session-ID': 'TESTONLY', 'X-Correlation-ID': 'TESTONLY' },
    });
    result.httpStatus = response.status;
    const body = await response.json().catch(() => null);
    result.validChallengeResponse = typeof body?.Token === 'string';
  } catch (error) {
    const safeCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
    const candidates = [error?.code, error?.cause?.code, ...(error?.cause?.errors ?? []).map(item => item?.code)];
    result.codes = candidates.filter(code => safeCodes.has(code));
    if (!result.codes.length) result.codes = [error.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'];
  }
  result.elapsedMs = Date.now() - started;
  return res.status(200).json(result);
}
