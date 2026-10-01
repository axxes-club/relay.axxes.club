import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {getCookies} from 'better-auth/cookies'
const exports={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/auth/base-url.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL})
const resolve=exports.resolveAuthBaseURL
const canonical='https://relay.axxes.club'
assert.equal(resolve({BETTER_AUTH_URL:canonical}),canonical)
assert.equal(resolve({BETTER_AUTH_URL:canonical,BETTER_AUTH_BASE_URL:'http://localhost:3000'}),canonical)
assert.equal(resolve({BETTER_AUTH_BASE_URL:canonical}),canonical)
assert.equal(resolve({BETTER_AUTH_URL:'undefined',BETTER_AUTH_BASE_URL:canonical}),canonical)
assert.equal(resolve({}),'http://localhost:3000')
for(const env of [{BETTER_AUTH_URL:canonical},{BETTER_AUTH_BASE_URL:canonical}]) {
 const cookie=getCookies({baseURL:resolve(env),advanced:{crossSubDomainCookies:{enabled:true,domain:'.axxes.club'}}}).sessionToken
 assert.equal(cookie.name,'__Secure-better-auth.session_token')
 assert.equal(cookie.attributes.secure,true)
 assert.equal(cookie.attributes.domain,'.axxes.club')
}
assert.equal(getCookies({baseURL:resolve({})}).sessionToken.name,'better-auth.session_token')
assert.match(fs.readFileSync('src/lib/auth/index.ts','utf8'),/baseURL: resolveAuthBaseURL\(process.env\)/)
console.log('Auth URL precedence, legacy fallback, malformed setting, and actual shared secure-cookie naming passed')
