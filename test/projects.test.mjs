import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectAccess} from '../src/projects.mjs';
const actor={memberships:[{projectId:'a',role:'developer'}]};
test('allows own project',()=>assert.equal(projectAccess(actor,'a','test'),true));
test('denies other project',()=>assert.equal(projectAccess(actor,'b','read'),false));
test('denies management',()=>assert.equal(projectAccess(actor,'a','manage'),false));
test('denies anonymous',()=>assert.equal(projectAccess(null,'a','read'),false));
