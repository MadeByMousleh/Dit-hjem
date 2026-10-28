import assert from 'node:assert/strict';
import {renderStoreButtons} from './lib/public-site-downloads.mjs';
const pending=renderStoreButtons({appStore:null,googlePlay:null});assert.equal((pending.match(/is-pending/g)??[]).length,2);assert.ok(!pending.includes('<a '));
const active=renderStoreButtons({appStore:'https://apps.apple.com/dk/app/huslyg/id1234567890',googlePlay:'https://play.google.com/store/apps/details?id=dk.example.synthetic&hl=da'});assert.equal((active.match(/<a /g)??[]).length,2);assert.ok(active.includes('&amp;hl=da'));assert.ok(!active.includes('is-pending'));
for(const [key,url]of [['appStore','https://apps.apple.com/'],['appStore','javascript:alert(1)'],['googlePlay','https://play.google.com/'],['googlePlay','https://play.google.com/store/apps/details'],['googlePlay','https://play.google.com.evil.invalid/store/apps/details?id=x'],['appStore','https://user:password@apps.apple.com/dk/app/huslyg/id123']])assert.throws(()=>renderStoreButtons({[key]:url}),url);
console.log('PASS: store buttons stay honestly pending without links, accept app-specific store URLs, escape parameters and reject wrong origins, store homepages and unsafe URLs. Synthetic URLs only.');
