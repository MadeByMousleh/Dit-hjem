import { findAddressSuggestionById, findAddressSuggestions } from '../../src/services/address-search.mjs';
import { getBbrProperty } from '../../src/services/bbr-property-server.mjs';
import { getHomePhotos } from '../../src/services/home-photos-server.mjs';
import { getPublicValuation } from '../../src/services/property-valuation-server.mjs';
import { getHomeGeometry, getHomeOrthophoto } from '../../src/services/home-geometry-server.mjs';
import { getHomeAirQuality } from '../../src/services/home-air-quality-server.mjs';
import { getHomeEnergyLabel } from '../../src/services/home-energy-label-server.mjs';
import { getHomeHeights } from '../../src/services/home-height-server.mjs';
import { getHomeModelPhotos } from '../../src/services/home-model-photos-server.mjs';

export default async function search(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (['model-photos','height','geometry','orthophoto','air','energy-label'].includes(request.query?.mode)) {
    response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
    try {
      const mode=request.query.mode;
      const result=mode==='model-photos'?await getHomeModelPhotos({id:request.query.id}):mode==='height'?await getHomeHeights({id:request.query.id}):mode==='geometry'?await getHomeGeometry({id:request.query.id}):mode==='orthophoto'?await getHomeOrthophoto({bbox:request.query.bbox}):mode==='air'?await getHomeAirQuality({id:request.query.id,x:request.query.x,y:request.query.y}):await getHomeEnergyLabel({buildingId:request.query.buildingId});
      if(Buffer.isBuffer(result)){response.setHeader('Content-Type','image/jpeg');return response.status(200).send(result);}return response.status(200).json(result);
    } catch(error){return response.status(error.status??502).json({error:'Boligens supplerende oplysninger kunne ikke hentes lige nu.',code:'HOME_DETAILS_UNAVAILABLE'});}
  }
  if (request.query?.mode === 'valuation') {
    response.setHeader('Cache-Control','no-store');
    try { return response.status(200).json(await getPublicValuation({ bfe: request.query.bfe })); }
    catch (error) { return response.status(error.status ?? 502).json({ error: 'Den offentlige vurdering kunne ikke hentes lige nu.', code:'VALUATION_UNAVAILABLE' }); }
  }
  if (request.query?.mode === 'photos') {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const result = await getHomePhotos({ x: request.query.x, y: request.query.y, direction: request.query.direction });
      if (Buffer.isBuffer(result)) { response.setHeader('Content-Type', 'image/jpeg'); return response.status(200).send(result); }
      return response.status(200).json(result);
    } catch (error) { return response.status(error.status ?? 502).json({ error: 'Boligbilleder kunne ikke hentes lige nu.', code: 'HOME_PHOTOS_UNAVAILABLE' }); }
  }

  const query = typeof request.query?.q === 'string' ? request.query.q.trim() : '';
  const id = typeof request.query?.id === 'string' ? request.query.id.trim() : '';
  if (request.query?.mode === 'bbr') {
    response.setHeader('Cache-Control', 'no-store');
    try { return response.status(200).json(await getBbrProperty({ id, address: query })); }
    catch (error) { return response.status(error.status ?? 502).json({ error: error.message ?? 'BBR kunne ikke hentes.', code: error.code ?? 'BBR_UNAVAILABLE' }); }
  }
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: 'Adresse-id er ugyldigt.' });
    try {
      const address = await findAddressSuggestionById(id);
      response.setHeader('Cache-Control', 'public, max-age=300');
      return response.status(200).json(address);
    } catch (error) {
      return response.status(502).json({ error: error instanceof Error ? error.message : 'Adressen kunne ikke hentes lige nu.' });
    }
  }
  if (query.length < 3) return response.status(200).json([]);
  if (query.length > 73) return response.status(400).json({ error: 'Adressen er for lang.' });

  try {
    const addresses = await findAddressSuggestions(query);
    response.setHeader('Cache-Control', 'public, max-age=300');
    return response.status(200).json(addresses);
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Adressen kunne ikke hentes lige nu.' });
  }
}
