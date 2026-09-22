// Operator-only: grants an explicitly named email access, never runs on signup.
import { createAdminClient } from '@supabase/server/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { accessFor, requestJson } from '../src/services/eloverblik-server.mjs';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: node --env-file=.env scripts/provision-household.mjs email');
const db = createAdminClient();
const checked = async promise => { const { data, error } = await promise; if (error) throw new Error('Household provisioning failed: ' + error.code); return data; };
try {
  const access = await accessFor(process.env.EL_OVERBLIK_TOKEN?.trim() ?? '');
  if (typeof access?.result !== 'string') throw new Error('Eloverblik authorization failed');
  const linked = await requestJson('/meteringpoints/meteringpoints', access.result);
  const types = new Set(['D07','D10','D12','D15','D17','E17']);
  const ids = [...new Set((linked.result ?? []).filter(p => p.hasRelation && !p.isMovedOut && types.has(p.typeOfMP) && /^\d{18}$/.test(p.meteringPointId)).map(p=>p.meteringPointId))];
  if (!ids.length || ids.length > 10) throw new Error('Expected between 1 and 10 consumption meters');
  let householdId = process.env.EL_OVERBLIK_HOUSEHOLD_ID;
  if (!householdId) {
    const household = await checked(db.from('households').insert({ name: 'Mit hjem' }).select('id').single());
    householdId = household.id;
    // Persist binding immediately so retries reuse the household.
    const path = '.env';
    const contents = readFileSync(path,'utf8').replace(/^EL_OVERBLIK_HOUSEHOLD_ID=.*\r?\n?/gm, '');
    writeFileSync(path, contents.trimEnd() + '\nEL_OVERBLIK_HOUSEHOLD_ID=' + householdId + '\n');
  }
  await checked(db.from('electricity_meters').upsert(ids.map(id=>({ household_id: householdId, metering_point_id:id })), { onConflict: 'household_id,metering_point_id' }));
  await checked(db.from('household_invitations').upsert({ household_id: householdId, email }, { onConflict: 'household_id,email' }));
  console.log(`Provisioned household with ${ids.length} meter(s) and the explicitly requested email invitation. No email sent.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
