import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeOpenCode} from '../src/opencode-admission.mjs';
const verified={publicPayloadApproved:true,isolatedWorkspaceVerified:true,meteredGatewayVerified:true,zeroSpendVerified:true,pinnedBinaryVerified:true,networkAllowlistVerified:true,mode:'proposal-only',directProviderCredentials:false,repositoryWriteToken:false};
test('default deny and explicit trusted attestations',()=>{
 assert.equal(authorizeOpenCode().allowed,false);
 assert.equal(authorizeOpenCode(verified).allowed,true);
 for(const k of Object.keys(verified))assert.equal(authorizeOpenCode({...verified,[k]:undefined}).allowed,false);
});
test('rejects direct credentials and write tokens',()=>{
 assert.equal(authorizeOpenCode({...verified,directProviderCredentials:true}).allowed,false);
 assert.equal(authorizeOpenCode({...verified,repositoryWriteToken:true}).allowed,false);
});
