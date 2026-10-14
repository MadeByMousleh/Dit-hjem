import { createHash } from 'node:crypto';
import { createAdminClient } from '@supabase/server/core';
import { activeAuthorizations } from '../src/services/eloverblik-third-party.mjs';
if (process.env.SUPABASE_URL?.replace(/\/$/, '') !== 'https://arkpfdsglgufnnukader.supabase.co') throw new Error('Unexpected diagnostic target');
const db = createAdminClient();
const { data: attempts, error } = await db.from('eloverblik_authorization_attempts').select('customer_key_hash,user_id,household_id,expires_at').gt('expires_at', new Date().toISOString());
if (error) { console.log('attempt_query_error', error.code); process.exit(1); }
const grants = await activeAuthorizations();
const matches = grants.flatMap(grant => attempts.filter(a=>grant.customerKey && a.customer_key_hash===createHash('sha256').update(grant.customerKey).digest('hex')).map(attempt=>({grant,attempt})));
console.log({ activeAttempts: attempts.length, activeGrants: grants.length, exactMatches: matches.length });
for (const {grant,attempt} of matches) {
  const { data: binding, error: bindingError } = await db.from('eloverblik_third_party_connections').select('user_id,household_id').eq('authorization_id',grant.authorizationId).maybeSingle();
  console.log({ grantIdIsUuid:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(grant.authorizationId), alreadyBound:!!binding, sameHousehold:binding?.household_id===attempt.household_id, sameUser:binding?.user_id===attempt.user_id, bindingError:bindingError?.code });
}
const template = new URL(process.env.EL_OVERBLIK_AUTH_LINK ?? process.env.ELOVERBLIK_AUTHORIZATION_URL);
const returnSetting = process.env.ELOVERBLIK_RETURN_URL || template.searchParams.get('returnUrl');
console.log({ configuredReturnOrigin:returnSetting ? new URL(returnSetting).origin : null, configuredReturnPath:returnSetting ? new URL(returnSetting).pathname : null });
