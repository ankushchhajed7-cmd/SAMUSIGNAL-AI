import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
/* har change me version badle: app.js, sw.js (cache naam) aur package.json teeno ek jaise hon */
test('version same everywhere', () => {
  const app = /export const VERSION = '([^']+)'/.exec(readFileSync('src/app.js', 'utf8'))[1];
  const sw = /const VERSION = '([^']+)'/.exec(readFileSync('sw.js', 'utf8'))[1];
  const pk = JSON.parse(readFileSync('package.json', 'utf8')).version;
  assert.equal(app, sw); assert.equal(app, pk);
});
