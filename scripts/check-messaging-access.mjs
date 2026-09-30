import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript')
function load(path,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n]},URL,process:{env:{}}});return exports}
const tenant='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003'
let query,rows=[],guardCalls=0,signedIn=true,allow=true
const schema=new Proxy({}, {get:(_,name)=>new Proxy({}, {get:(_,field)=>`${name}.${field}`})})
const chain={select(){return this},from(){return this},innerJoin(){return this},where(q){query=q;return this},limit(){return Promise.resolve(rows)}}
const access=load('src/lib/messaging-access.ts',{'server-only':{},'drizzle-orm':{and:(...x)=>x,eq:(...x)=>x,isNull:x=>['null',x]},'@/lib/db':{db:chain},'@/lib/db/schema':schema})
await assert.rejects(access.assertConversationAccess('bad','user',tenant))
await assert.rejects(access.assertConversationAccess(id,'user',tenant))
rows=[{id}];await access.assertConversationAccess(id,'user',tenant)
assert.ok(JSON.stringify(query).includes('conversations.tenantId'));assert.ok(JSON.stringify(query).includes(tenant));assert.ok(JSON.stringify(query).includes('conversationParticipants.leftAt'));assert.ok(JSON.stringify(query).includes('conversations.deletedAt'))
const api=load('src/lib/auth/tenant-context.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},'next/headers':{headers:async()=>new Map()},'@/lib/auth':{auth:{api:{getSession:async()=>signedIn?{user:{id:'user'}}:null}}},'@/lib/context':{getContext:async hint=>hint===other?null:{userId:'user',tenant:{id:tenant}},requireContext:async()=>({userId:'user',tenant:{id:tenant}})},'@/lib/messaging-access':{assertConversationAccess:async()=>{guardCalls++;if(!allow)throw Error()}}})
const req=path=>({nextUrl:new URL('https://relay.axxes.club'+path)})
const handler=async(t,u)=>({status:200,tenant:t,user:u})
signedIn=false;assert.equal((await api.withTenantAccess(req('/api/v1/conversations'),handler)).status,401)
signedIn=true;assert.equal((await api.withTenantAccess(req('/api/v1/conversations?tenantId='+other),handler)).status,403)
allow=false;assert.equal((await api.withTenantAccess(req('/api/v1/conversations/'+id+'/messages'),handler)).status,403)
allow=true;assert.equal((await api.withTenantAccess(req('/api/v1/conversations/'+id+'/messages'),handler)).tenant,tenant);assert.equal(guardCalls,2)
for(const file of ['src/lib/auth/index.ts','src/lib/auth/tenant-context.ts'])assert.ok(!fs.readFileSync(file,'utf8').includes('get("tenant_id")'))
assert.ok(fs.existsSync('src/app/(app)/overview/page.tsx'));assert.ok(fs.existsSync('src/app/(app)/new/page.tsx'));assert.ok(!fs.existsSync('src/app/(app)/page.tsx'))
console.log('Messaging selected context, signed-out401, foreign hint403, foreign conversation403, active participation/tenant SQL and distinct routes passed')

const safety=load('src/lib/messaging-safety.ts',{})
const reply={tenantId:tenant,conversationId:id,deletedAt:null,content:'safe'}
assert.equal(safety.safeReply(reply,tenant,id).content,'safe')
assert.equal(safety.safeReply({...reply,tenantId:other},tenant,id),null)
assert.equal(safety.safeReply({...reply,conversationId:other},tenant,id),null)
assert.equal(safety.safeReply({...reply,deletedAt:new Date()},tenant,id),null)
assert.equal(safety.safeReply([reply],tenant,id),null)
console.log('Legacy foreign conversation/tenant/deleted reply serialization denied')
