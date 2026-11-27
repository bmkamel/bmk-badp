import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize } from '../src/policy.mjs';
const scope = { projectId: 'demo', actorId: 'owner', paid: false };
test('allows scoped inspection', () => assert.equal(authorize('inspect', scope).allowed, true));
test('denies missing scope', () => assert.equal(authorize('inspect', {}).allowed, false));
test('denies deployment', () => assert.equal(authorize('deploy', scope).allowed, false));
test('denies paid operations', () => assert.equal(authorize('plan', {...scope, paid: true}).allowed, false));
test('denies unknown action', () => assert.equal(authorize('unknown', scope).allowed, false));
