const test = require('node:test');
const assert = require('node:assert/strict');
const { mapSnapshot, snapshotToUpdates } = require('../dist/mappings.js');

test('maps captured RUT906 read-only status into a safe snapshot', () => {
  const snapshot = mapSnapshot(
    { mnfinfo: { name: 'RUT90600XXXX', hwver: '0404', blver: '4.3.0' } },
    { uptime_seconds: 10, localtime: 100, memory: {}, load: {} },
    [{ state: 'Connected', operator: 'Example', signal: -48, temperature: 35, rxbytes: 12, txbytes: 3, simstate: 'Inserted', band: 'LTE B7' }],
    [{ used: 2, total: 25 }],
    [{ id: '1', message: '[REDACTED]' }],
    { longitude: '8.592463', latitude: '56.494766', altitude: '49.9', accuracy: '1.16', fix_status: '1', satellites: '9', speed: '0', timestamp: '1787660370', utc_timestamp: '1787656770' }
  );

  assert.equal(snapshot.device.model, 'RUT90600XXXX');
  assert.equal(snapshot.modem.signal, -48);
  assert.equal(snapshot.sms.messageCount, 1);
  assert.equal(snapshot.gps.available, true);
  assert.equal(snapshot.gps.latitude, 56.494766);
  assert.equal(snapshot.gps.longitude, 8.592463);
  const updates = snapshotToUpdates(snapshot);
  assert.equal(updates.find((update) => update.path.endsWith('.cellular.signal')).value, -48);
  assert.equal(updates.find((update) => update.path.endsWith('.gps.available')).value, true);
  assert.equal(updates.find((update) => update.path === 'navigation.position.latitude').value, 56.494766);
  assert.equal(updates.find((update) => update.path === 'navigation.position.longitude').value, 8.592463);
  assert.equal(updates.find((update) => update.path === 'navigation.gnss.satellites').value, 9);
});
