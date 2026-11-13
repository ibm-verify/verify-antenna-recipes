const fs=require('fs'), vm=require('vm'), assert=require('assert');
const base=__dirname+'/../';
const tx=fs.readFileSync(base+'transmitter/configs/js/verify_agent_registry_mapper.js','utf8');
const rx=fs.readFileSync(base+'vault-receiver/configs/js/vault_agent_registry_action.js','utf8');
const PATCH='urn:ietf:params:scim:event:prov:patch:full';
let agent={id:'agent-1',status:'ACTIVE',displayName:'Lab',oauthClients:[{clientId:'actor-1',purposes:['agent_id']}]};
const raw={id:'audit-1',event_type:'management',data:{id:'agent-1',resource:'ai_agent',action:'modified',result:'success',modified:{status:{old:'DRAFT',new:'ACTIVE'},oauthClients:{new:['actor-1']}}}};
function run(code,event,http){let c={eventStr:JSON.stringify(event),importClass(){},logger:{info(){},debug(){}},http};vm.createContext(c);vm.runInContext(code.replaceAll("${VERIFY_AGENT_API_PATH}","/v1.0/Agents").replaceAll("${SUBJECT_FORMAT}","scim"),c);return c;}
let checks=0;
function check(name,fn){fn();checks++; console.log('PASS '+name);}
const httpTx={post(){return {status:200,body:'{"access_token":"test"}'}},get(){return {status:200,body:JSON.stringify(agent)}}};
let set;
check('modified maps new values, PatchOp-only schema, SCIM subject and txn',()=>{set=run(tx,raw,httpTx).outputData.ssfEvents[0];assert.equal(set.sub_id.uri,'/Agents/agent-1');assert.equal(set.txn,'audit-1');assert.equal(set.events[PATCH].data.schemas.length,1);assert.deepEqual(JSON.parse(JSON.stringify(set.events[PATCH].data.Operations)),[{op:'replace',path:'status',value:'ACTIVE'},{op:'replace',path:'oauthClients',value:['actor-1']}]);});
check('failed audit emits nothing',()=>{const e=structuredClone(raw);e.data.result='failure';assert.equal(run(tx,e,httpTx).outputData.ssfEvents.length,0)});
check('missing new throws',()=>{const e=structuredClone(raw);delete e.data.modified.status.new;assert.throws(()=>run(tx,e,httpTx));});
check('empty array retained',()=>{const e=structuredClone(raw);e.data.modified.tags={new:[]};assert.equal(run(tx,e,httpTx).outputData.ssfEvents[0].events[PATCH].data.Operations[2].value.length,0)});
check('missing resource ID cannot fall back to audit ID',()=>{const e=structuredClone(raw);delete e.data.id;assert.throws(()=>run(tx,e,httpTx));});
let entity=null,reg=null,writes=[],entityCreates=0,regCreates=0,forbidRead=false;
const response=(status,data)=>({status,body:JSON.stringify(data)});
const httpRx={
 get(o,url){if(url.includes('/Agents/'))return forbidRead?response(503,{}):response(200,agent);
 if(url.includes('identity/entity/name/'))return entity?response(200,{data:entity}):response(404,{});
 if(url.includes('registration/entity-id/'))return reg?response(200,{data:reg}):response(404,{});
 throw Error('unexpected GET '+url)},
 post(o,url,body){if(url.endsWith('/oauth2/token'))return response(200,{access_token:'test'});const p=JSON.parse(body);writes.push({url,p});
 if(url.endsWith('identity/lookup/entity'))return response(200,{data:entity&&entity.alias?{id:entity.id}:{}});
 if(url.endsWith('identity/entity')){entity={...p,id:'vault-1'};entityCreates++;return response(200,{data:entity})}
 if(url.includes('identity/entity/id/')){Object.assign(entity,p);return response(200,{data:entity})}
 if(url.endsWith('identity/entity-alias')){entity.alias=p.name;return response(200,{data:{id:'alias-1'}})}
 if(url.endsWith('agent-registry/register')){reg={...p,id:'reg-'+(++regCreates)};return response(200,{data:reg})}
 if(url.includes('registration/id/')){Object.assign(reg,p);return response(200,{data:reg})}
 throw Error('unexpected POST '+url)},
 delete(o,url){writes.push({url,del:true});reg=null;return response(204,{})}
};
check('ACTIVE provisions entity, alias, registration ceiling, no entity ACL grant',()=>{run(rx,set,httpRx);assert.equal(entity.disabled,false);assert.equal(entity.alias,'actor-1');assert.equal(reg.entity_id,'vault-1');assert.equal(reg.optional_authorization_details,false);assert.equal(entity.policies.length,0)});
check('duplicate delivery converges',()=>{run(rx,set,httpRx);assert.equal(entityCreates,1);assert.equal(regCreates,1)});
check('rename retains same entity',()=>{agent.displayName='Renamed';run(rx,set,httpRx);assert.equal(entity.id,'vault-1');assert.equal(reg.display_name,'Renamed')});
check('suspension disables before deleting registration',()=>{agent.status='SUSPENDED';writes=[];run(rx,set,httpRx);assert.equal(entity.disabled,true);assert.equal(reg,null);assert(writes.findIndex(x=>x.p&&x.p.disabled===true)<writes.findIndex(x=>x.del));});
check('reactivation retains entity UUID',()=>{agent.status='ACTIVE';run(rx,{claimsJson:JSON.stringify(set)},httpRx);assert.equal(entity.id,'vault-1');assert.equal(entity.disabled,false);assert(reg)});
check('Verify outage writes nothing',()=>{forbidRead=true;writes=[];assert.throws(()=>run(rx,set,httpRx));assert.equal(writes.length,0);forbidRead=false});
check('unknown purpose aborts without Vault changes',()=>{agent.oauthClients=[{clientId:'actor-1'}];writes=[];assert.throws(()=>run(rx,set,httpRx));assert.equal(writes.length,0);assert.equal(entity.disabled,false);assert(reg)});
check('multiple clients stop before Vault writes',()=>{agent.oauthClients=['a','b'].map(clientId=>({clientId,purposes:['agent_id']}));writes=[];assert.throws(()=>run(rx,set,httpRx));assert.equal(writes.length,0)});

check('actual tenant stringified attribute-keyed changes map correctly',()=>{
 const e=structuredClone(raw);
 e.data.modified=JSON.stringify([{status:{new:'ACTIVE',old:'SUSPENDED'}},{oauthClients:{new:['actor-1'],old:null}}]);
 const result=run(tx,e,httpTx).outputData.ssfEvents[0];
 assert.equal(result.events[PATCH].data.Operations[0].value,'ACTIVE');
 assert.equal(result.events[PATCH].data.Operations[1].path,'oauthClients');
});
check('opaque mode produces matching subject ID and URI',()=>{
 const result=run(tx.replaceAll('${SUBJECT_FORMAT}','opaque'),raw,httpTx).outputData.ssfEvents[0];
 assert.equal(result.sub_id.format,'opaque');assert.equal(result.sub_id.id,'agent-1');
 agent.oauthClients=[{clientId:'actor-1',purposes:['agent_id']}];
 run(rx.replaceAll('${SUBJECT_FORMAT}','opaque'),result,httpRx);
 assert.equal(entity.disabled,false);
});
check('opaque mismatched ID aborts',()=>{
 const e=JSON.parse(JSON.stringify(set));e.sub_id.format='opaque';e.sub_id.id='wrong';
 writes=[];assert.throws(()=>run(rx.replaceAll('${SUBJECT_FORMAT}','opaque'),e,httpRx));assert.equal(writes.length,0);
});
check('unknown lifecycle state aborts',()=>{
 agent.status='UNEXPECTED';writes=[];assert.throws(()=>run(rx,set,httpRx));assert.equal(writes.length,0);agent.status='ACTIVE';
});
check('string-valued Vault 403 propagates before writes',()=>{
 const bad={...httpRx,get(o,url){if(url.includes('identity/entity/name/'))return {status:'403 Forbidden',body:'{}'};return httpRx.get(o,url)}};
 writes=[];assert.throws(()=>run(rx,set,bad));assert.equal(writes.length,0);
});
console.log('All '+checks+' offline checks passed. No external service was contacted.');
