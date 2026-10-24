import assert from 'node:assert/strict';
import test from 'node:test';
import { isLostLead } from './leadStatus.js';

test('Lost Leads selects the same record without removing it from All Leads', () => {
  const leads = [{ id: 'active', status: 'New' }, { id: 'lost', status: 'Lost' }];
  const lostLeads = leads.filter(isLostLead);
  assert.equal(leads.length, 2);
  assert.deepEqual(lostLeads.map((lead) => lead.id), ['lost']);
  assert.equal(lostLeads[0], leads[1]);
});

test('custom lost stages and converted leads marked lost remain visible', () => {
  assert.equal(isLostLead({ status: 'Not Interested', isLost: true }), true);
  assert.equal(isLostLead({ status: 'Lost', isConverted: true }), true);
  assert.equal(isLostLead({ status: 'Closed' }), true);
  assert.equal(isLostLead({ status: 'Converted' }), false);
  assert.equal(isLostLead({ status: 'New', isLost: false }), false);
});
