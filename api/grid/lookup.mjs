import { findGridSupplier } from '../../src/services/grid-lookup.mjs';
import {getEnerginetPrices} from '../../src/services/energinet-prices-server.mjs';
import {getGridPriceForecast} from '../../src/services/price-forecast-server.mjs';
import {ENERGINET_GRID_SUPPLIERS,PRICE_SOURCE} from '../../src/services/energinet-tariff-catalog.mjs';
import {publicPricePage} from '../../src/services/public-price-page.mjs';

export default async function lookup(request, response) {
  if (request.method !== 'GET' && !(request.method==='HEAD'&&request.query?.operation==='public-page')) return response.status(405).json({ error: 'Method not allowed' });
  try {
    const operation=request.query?.operation;
    if(operation==='public-page')return await publicPricePage(request,response);
    if(operation==='forecast'){
      const result=await getGridPriceForecast(request.query);
      response.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
      return response.status(200).json(result);
    }
    if(operation==='suppliers'){
      response.setHeader('Cache-Control','public, max-age=86400');
      return response.status(200).json({suppliers:ENERGINET_GRID_SUPPLIERS.map(({tariffCodes,optionalCodes,history,...s})=>s),source:PRICE_SOURCE});
    }
    if(operation==='prices'){
      const result=await getEnerginetPrices(request.query);
      response.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
      return response.status(200).json(result);
    }
    if(operation) return response.status(400).json({error:'Ukendt prisoperation'});
    const x = Number(request.query?.x);
    const y = Number(request.query?.y);
    const result = await findGridSupplier(x, y);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return response.status(200).json(result);
  } catch (error) {
    if(request.query?.operation){response.setHeader('Cache-Control','no-store');response.setHeader('Retry-After','60');return response.status([400,404,429].includes(error?.status)?error.status:503).json({error:error instanceof Error?error.message:'Prisdata er utilgængelige.'});}
    return response.status(404).json({ error: error instanceof Error ? error.message : 'Netselskabet kunne ikke findes' });
  }
}

