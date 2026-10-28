import {familyResponse} from '../../src/services/family-server.mjs';
import {accountPrivacyResponse} from '../../src/services/account-privacy-server.mjs';
import { vaultWriteResponse } from '../../src/services/vault-write-server.mjs';
import { managedVaultKeyResponse } from '../../src/services/managed-vault-key-server.mjs';
import { heatingConnectionResponse } from '../../src/services/heating-connection-server.mjs';
import { MAX_WRITE_BYTES } from '../../src/services/vault-signing.mjs';
import { electricityRecordWriteResponse } from '../../src/services/electricity-record-server.mjs';
import { facadeAnalysisResponse } from '../../src/services/facade-analysis-server.mjs';
import { wallColorsResponse } from '../../src/services/wall-colors-server.mjs';
import { analyzeAerialOpenings } from '../../src/services/aerial-openings-server.mjs';
import { multiviewOpeningsResponse } from '../../src/services/facade-multiview-server.mjs';
import { propertyModelResponse } from '../../src/services/property-model-server.mjs';
import { propertyDocumentsResponse } from '../../src/services/property-documents-server.mjs';
import {spotPriceCronResponse} from '../../src/services/spot-price-archive-server.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const jobUrl=new URL(request.url??'/api/energy/vault','https://localhost');
  if(jobUrl.searchParams.get('job')==='spot-history'){
    const result=await spotPriceCronResponse(new Request(jobUrl,{method:request.method,headers:{authorization:request.headers.authorization??''}}));
    return response.status(result.status).json(result.body);
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  let body;
  try {
    if (typeof request.body === 'string' && Buffer.byteLength(request.body) > MAX_WRITE_BYTES) return response.status(413).json({ error: 'Backup er for stor.' });
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  } catch { return response.status(400).json({ error: 'Invalid JSON' }); }
  const req = new Request('https://localhost/api/energy/vault', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } });
  if(body?.operation==='account-privacy'){const result=await accountPrivacyResponse(req,body);return response.status(result.status).json(result.body);}
  if(body?.operation==='family'){const result=await familyResponse(req,body);return response.status(result.status).json(result.body);}
  if(body?.operation==='property-model'){const result=await propertyModelResponse(req,body);return response.status(result.status).json(result.body);}
  if(body?.operation==='property-documents'){const result=await propertyDocumentsResponse(req,body);return response.status(result.status).json(result.body);}
  const result = body?.operation === 'aerial-openings-multiview' ? await multiviewOpeningsResponse(req,body) : body?.operation === 'aerial-openings' ? await wallColorsResponse(req,body,undefined,analyzeAerialOpenings) : body?.operation === 'wall-colors' ? await wallColorsResponse(req,body) : body?.operation === 'facade-analysis' ? await facadeAnalysisResponse(req,body) : body?.action === 'managed-key'
    ? await managedVaultKeyResponse(req, body)
    : body?.operation === 'heating'
      ? await heatingConnectionResponse(req, body)
      : body?.operation === 'electricity-records'
        ? await electricityRecordWriteResponse(req, body.write)
        : await vaultWriteResponse(req, body);
  return response.status(result.status).json(result.body);
}
