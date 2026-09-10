import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseModelClient } from '../src/services/model-choice.js';

test('prefers the configured local model while retaining Agnes as the default proxy', () => {
  const local = { name: 'local' };
  const agnes = { name: 'agnes' };
  assert.equal(
    chooseModelClient({
      localBaseUrl: 'http://127.0.0.1:8000/api/v1',
      createLocal: () => local,
      createAgnes: () => agnes,
    }),
    local,
  );
  assert.equal(
    chooseModelClient({ localBaseUrl: '', createLocal: () => local, createAgnes: () => agnes }),
    agnes,
  );
});
