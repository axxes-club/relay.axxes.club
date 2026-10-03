import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {z} from 'zod'
const exports={};let allowed=true,row,patch,query
const schema=new Proxy({}, {get:(_,table)=>new Proxy({}, {get:(_,column)=>`${table}.${column}`})})
const db={query:{messages:{findFirst:async options=>{query=options.where;return row}}},update:()=>({set:value=>{patch=value;return {where:async()=>{}}}})}
const mocks={'@/lib/db':{db},'@/lib/db/schema':schema,'drizzle-orm':{eq:(...args)=>args,and:(...args)=>args,desc:x=>x,sql:()=>{},inArray:()=>{},ne:()=>{},isNull:x=>['null',x]},'next/cache':{revalidatePath:()=>{}},zod:{z},'@/lib/messaging-access':{assertConversationAccess:async()=>{if(!allowed)throw Error('denied')}},'@/lib/chat/reactions':{REACTIONS:['👍','❤️']},'@/lib/auth':{getAuthContext:async()=>({userId:'actor',tenantId:'tenant'})},'@/lib/pusher/server':{getPusherServer:()=>({trigger:async()=>{}}),getConversationChannel:x=>x,getUserChannel:x=>x,PUSHER_EVENTS:{MESSAGE_UPDATED:'updated',MESSAGE_DELETED:'deleted'}}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/actions/messaging.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name]},Date,Set,console})
const id='11111111-1111-4111-8111-111111111111';row={id,conversationId:'conversation',senderId:'actor',tenantId:'tenant',content:'hello',createdAt:new Date(),metadata:{}}
await exports.toggleReaction(id,'👍');assert.deepEqual(JSON.parse(JSON.stringify(patch.metadata)),{reactions:{'👍':['actor']}});assert.ok(JSON.stringify(query).includes('messages.tenantId'));assert.ok(JSON.stringify(query).includes('messages.deletedAt'))
row.metadata=patch.metadata;await exports.toggleReaction(id,'👍');assert.deepEqual(JSON.parse(JSON.stringify(patch.metadata.reactions)),{})
await assert.rejects(exports.toggleReaction(id,'arbitrary'));await assert.rejects(exports.editMessage('bad','hello'));await assert.rejects(exports.editMessage(id,' '))
row.senderId='other';patch=undefined;await assert.rejects(exports.editMessage(id,'new'),/own messages/);await assert.rejects(exports.deleteMessage(id),/own messages/);assert.equal(patch,undefined)
allowed=false;row.senderId='actor';await assert.rejects(exports.toggleReaction(id,'👍'),/denied/);await assert.rejects(exports.editMessage(id,'new'),/denied/);await assert.rejects(exports.setMuted('conversation',true),/denied/);assert.equal(patch,undefined)
const listeners={};let writes=0,network=0
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://relay.axxes.club'},addEventListener:(name,fn)=>listeners[name]=fn},URL,caches:{match:async()=>null,open:async()=>({put:()=>{writes++}})},fetch:async()=>{network++;return {ok:true,clone:()=>({})}}})
async function request(path,mode='cors'){let response;listeners.fetch({request:{url:'https://relay.axxes.club'+path,method:'GET',mode},respondWith:p=>response=p});if(response)await response;return response}
assert.equal(await request('/api/v1/conversations'),undefined);assert.equal(await request('/sign-in','navigate'),undefined);assert.equal(await request('/inbox?_rsc=private','navigate'),undefined)
await request('/inbox','navigate');assert.equal(writes,0);await request('/_next/static/asset.js');await Promise.resolve();assert.equal(writes,1);assert.equal(network,2)
console.log('Modern messaging reactions, author/member restrictions, validation, tenant query and private-page/API cache checks passed')
