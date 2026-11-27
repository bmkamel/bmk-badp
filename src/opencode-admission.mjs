// No direct provider credentials are permitted for an external agent.
export function authorizeOpenCode(config={}){
 const required=['publicPayloadApproved','isolatedWorkspaceVerified','meteredGatewayVerified','zeroSpendVerified','pinnedBinaryVerified','networkAllowlistVerified'];
 if(required.some(key=>config[key]!==true))return Object.freeze({allowed:false,reason:'unverified_execution_boundary'});
 if(config.mode!=='proposal-only'||config.directProviderCredentials!==false||config.repositoryWriteToken!==false)return Object.freeze({allowed:false,reason:'unsafe_execution_mode'});
 return Object.freeze({allowed:true,mode:'proposal-only'});
}
