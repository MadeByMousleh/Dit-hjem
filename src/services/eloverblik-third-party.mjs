import { createHash, randomUUID } from 'node:crypto';

const baseUrl = 'https://api.eloverblik.dk/thirdpartyapi/api';
const accessTokens = new Map();
const meterAccess = new Map();

export class ThirdPartyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Provider authorization IDs are opaque strings. The public Swagger describes
// UUIDs, but a real approved connection returned an ID rejected by PostgreSQL's
// UUID input parser. Never reinterpret IDs as customer-facing grant numbers.
export function isAuthorizationId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(value);
}

function configuredRefreshToken(env = process.env) {
  const token = env.ELOVERBLIK_THIRD_PARTY_API_TOKEN?.trim();
  if (!token || token.length < 20) throw new ThirdPartyError(503, 'Eloverblik-tredjepartsadgang er ikke konfigureret.');
  return token;
}

async function request(path, token, options = {}, dependencies = {}) {
  const fetcher = dependencies.fetcher ?? fetch;
  let response;
  try { response = await fetcher(baseUrl + path, {
    ...options,
    headers: {
      Accept: 'application/json',
      'api-version': '1.0',
      Authorization: `Bearer ${token}`,
      'X-User-Correlation-ID': dependencies.correlationId ?? randomUUID(),
      ...(options.headers ?? {}),
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
    redirect: 'error',
  }); } catch { throw new ThirdPartyError(502, 'Forbindelsen til Eloverblik mislykkedes. Prøv igen.'); }
  if (response.status === 401 || response.status === 403) throw new ThirdPartyError(502, 'Eloverblik afviste tredjepartsforbindelsen.');
  if (response.status === 429 || response.status === 503) throw new ThirdPartyError(503, 'Eloverblik er midlertidigt optaget. Prøv igen om et øjeblik.');
  if (!response.ok) throw new ThirdPartyError(502, 'Eloverblik kunne ikke hente data lige nu.');
  try { return await response.json(); }
  catch { throw new ThirdPartyError(502, 'Eloverblik returnerede et ugyldigt svar.'); }
}

export async function dataAccessToken(env = process.env, dependencies = {}) {
  const refreshToken = configuredRefreshToken(env);
  const key = createHash('sha256').update(refreshToken).digest('hex');
  const cached = accessTokens.get(key);
  if (cached?.expiresAt > Date.now()) return cached.promise;
  if (accessTokens.size > 10) accessTokens.clear();
  const promise = request('/token', refreshToken, {}, dependencies)
    .then(payload => {
      if (typeof payload?.result !== 'string' || !payload.result) throw new ThirdPartyError(502, 'Eloverblik udstedte ikke et adgangstoken.');
      return payload.result;
    })
    .catch(error => { accessTokens.delete(key); throw error; });
  accessTokens.set(key, { promise, expiresAt: Date.now() + 23 * 60 * 60 * 1000 });
  return promise;
}

export function authorizationRecord(value) {
  // Preserve the API's exact opaque identifier, not the portal's visible number.
  const authorizationId = typeof value?.id === 'string' ? value.id.trim() : '';
  const customerKey = typeof value?.customerKey === 'string' && value.customerKey ? value.customerKey : null;
  if (!isAuthorizationId(authorizationId)) return null;
  return {
    authorizationId,
    customerKey,
    from: typeof value.validFrom === 'string' ? value.validFrom : null,
    to: typeof value.validTo === 'string' ? value.validTo : null,
  };
}

export async function activeAuthorizations(env = process.env, dependencies = {}) {
  const token = await dataAccessToken(env, dependencies);
  const payload = await request('/authorization/authorizations', token, {}, dependencies);
  if (!Array.isArray(payload?.result)) throw new ThirdPartyError(502, 'Eloverblik returnerede et ukendt fuldmagtsformat.');
  return payload.result.map(authorizationRecord).filter(Boolean);
}

export async function authorizationForCustomerKey(customerKey, env = process.env, dependencies = {}) {
  if (typeof customerKey !== 'string' || !/^[A-Za-z0-9_-]{16,160}$/.test(customerKey)) throw new ThirdPartyError(400, 'Forbindelsen har en ugyldig kundenøgle.');
  const matches = (await activeAuthorizations(env, dependencies)).filter(item => item.customerKey === customerKey);
  if (matches.length > 1) throw new ThirdPartyError(409, 'Flere fuldmagter matcher forbindelsen. Start en ny forbindelse.');
  return matches[0] ?? null;
}

export async function meteringPointsForAuthorization(authorizationId, env = process.env, dependencies = {}) {
  return (await meteringPointAccessForAuthorization(authorizationId, env, dependencies)).map(item => item.meteringPointId);
}

export async function meteringPointAccessForAuthorization(authorizationId, env = process.env, dependencies = {}) {
  if (!isAuthorizationId(authorizationId)) {
    throw new ThirdPartyError(400, 'Eloverblik-forbindelsen er ugyldig.');
  }
  const cacheKey = createHash('sha256').update(`${configuredRefreshToken(env)}\n${authorizationId}`).digest('hex');
  const previous = meterAccess.get(cacheKey);
  if (previous?.until > Date.now()) return previous.promise;
  if (meterAccess.size > 1000) meterAccess.clear();
  const entry = { until: Date.now() + 60000, promise: (async () => {
    const accessToken = await dataAccessToken(env, dependencies);
    const payload = await request(`/authorization/authorization/meteringpoints/authorizationId/${encodeURIComponent(authorizationId)}`, accessToken, {}, dependencies);
    if (!Array.isArray(payload?.result)) throw new ThirdPartyError(502, 'Eloverblik returnerede et ukendt målerformat.');
    const items = payload.result;
    return [...new Map(items.map(item => ({ ...item, meteringPointId: String(item?.meteringPointId ?? item?.id ?? '').trim() })).filter(item => /^\d{18}$/.test(item.meteringPointId)).map(item => [item.meteringPointId, item])).values()];
  })() };
  meterAccess.set(cacheKey, entry);
  try { const result = await entry.promise; if (!result.length && meterAccess.get(cacheKey) === entry) meterAccess.delete(cacheKey); return result; }
  catch (error) { if (meterAccess.get(cacheKey) === entry) meterAccess.delete(cacheKey); throw error; }
}

export async function meteringPointReadings(authorizationId, meteringPointId, from, to, aggregation, env = process.env, dependencies = {}) {
  if (!/^\d{18}$/.test(String(meteringPointId)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to)) || !['Actual', 'Quarter', 'Hour', 'Day', 'Month', 'Year'].includes(aggregation)) {
    throw new ThirdPartyError(400, 'Ugyldig forespørgsel til Eloverblik.');
  }
  const allowed = await meteringPointsForAuthorization(authorizationId, env, dependencies);
  if (!allowed.includes(meteringPointId)) throw new ThirdPartyError(403, 'Måleren er ikke omfattet af din fuldmagt.');
  const accessToken = await dataAccessToken(env, dependencies);
  return await request(`/meterdata/gettimeseries/${from}/${to}/${aggregation}`, accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meteringPoints: { meteringPoint: [meteringPointId] } }),
  }, dependencies);
}

export async function meteringPointGridDetails(authorizationId,env=process.env,dependencies={}){
 const access=await meteringPointAccessForAuthorization(authorizationId,env,dependencies);
 const allowed=access.filter(m=>!m.typeOfMP||m.typeOfMP==='E17');
 if(!allowed.length)return [];
 if(allowed.length>50)throw new ThirdPartyError(409,'For mange målere til et sikkert netselskabsopslag.');
 const token=await dataAccessToken(env,dependencies),ids=allowed.map(m=>m.meteringPointId);
 const payload=await request('/meteringpoint/getdetails',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({meteringPoints:{meteringPoint:ids}})},dependencies);
 if(!Array.isArray(payload?.result)||payload.result.length!==ids.length)throw new ThirdPartyError(502,'Målerens netselskab kunne ikke bekræftes.');
 const found=new Map();
 for(const row of payload.result){
  const meter=row?.result,id=String(meter?.meteringPointId??row?.id??'');
  if(row?.success!==true||!ids.includes(id)||found.has(id)||(row.id&&row.id!==id))throw new ThirdPartyError(502,'Ugyldige netselskabsoplysninger fra Eloverblik.');
  if(meter.typeOfMP!=='E17')throw new ThirdPartyError(409,'Måleren er ikke et forbrugsmålepunkt.');
  const text=(v,max=140)=>typeof v==='string'&&v.trim().length<=max?v.trim():null;
  found.set(id,{meteringPointId:id,typeOfMP:'E17',gridOperatorName:text(meter.gridOperatorName),gridOperatorId:text(meter.gridOperatorID,80),gridArea:text(meter.meteringGridAreaIdentification,40),darReference:text(meter.darReference,40)});
 }
 return [...found.values()];
}
export const __testing = { clearCache: () => { accessTokens.clear(); meterAccess.clear(); } };
