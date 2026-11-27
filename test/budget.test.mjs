import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReserve} from '../src/budget.mjs';
test('allows within cap',()=>assert.equal(canReserve({spent:300,reserved:200,estimate:500}),true));
test('denies above cap',()=>assert.equal(canReserve({spent:300,reserved:200,estimate:501}),false));
test('denies negative and invalid values',()=>{for(const estimate of [-1,NaN,Infinity,0.5]) assert.equal(canReserve({spent:0,reserved:0,estimate}),false)});
test('denies raised cap',()=>assert.equal(canReserve({spent:0,reserved:0,estimate:1,limit:1001}),false));
