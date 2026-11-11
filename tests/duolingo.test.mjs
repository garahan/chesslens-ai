import test from 'node:test';
import assert from 'node:assert/strict';
import {duolingoSignatures} from '../src/duolingo-signatures.ts';
test('Duolingo signatures include each piece and empty squares',()=>{
 const rows=duolingoSignatures.trim().split('\n');
 const labels=new Set(rows.map(s=>s.split('|')[0]));
 assert.equal(rows.length,26);
 assert.equal(labels.size,13);
 for(const row of rows){
  const [label,m,c]=row.split('|');
  assert.equal(m.length,144,label);
  assert.match(m,/^[0-9]+$/);
  assert.equal(c.split(',').length,3);
 }
});
