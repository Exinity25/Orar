const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../classroom-view.js'), 'utf8');
const section = source.slice(source.indexOf('    const ensureGoogleSessionForSection=()=>{'), source.indexOf("    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensureFreshGoogleSession();"));
function scenario(overrides = {}) {
  const calls = [];
  const ctx = { token:'', expires:0, client:{}, navigator:{userActivation:{isActive:true}},
    reauthenticating:false, silentRenewing:false, sectionReconnectAttempted:false,
    prepareSignIn(){}, rememberedAccount:()=>({email:'test@example.com'}),
    clearSession(){ctx.token='';}, requestAccess:remembered=>calls.push(remembered), ...overrides };
  vm.createContext(ctx);
  vm.runInContext(section + '\nthis.enter=ensureGoogleSessionForSection;', ctx);
  return {ctx,calls};
}
let s=scenario();s.ctx.enter();s.ctx.enter();assert.deepEqual(s.calls,[true], 'one attempt, no repeat after cancellation');
for(const overrides of [
  {navigator:{userActivation:{isActive:false}}}, {navigator:{}},
  {rememberedAccount:()=>null}, {client:null}, {reauthenticating:true},
  {silentRenewing:true}, {token:'valid',expires:Date.now()+60000}
]) {s=scenario(overrides);s.ctx.enter();assert.equal(s.calls.length,0,'no popup without an eligible navigation tap');}
s=scenario({token:'expired',expires:1});s.ctx.enter();assert.deepEqual(s.calls,[true]);assert.equal(s.ctx.token,'');
const request=source.slice(source.indexOf('    function requestAccess('),source.indexOf("    page.addEventListener('click',e=>{\n      const preview="));
const requests=[];
const ctx={client:{requestAccessToken:options=>requests.push(options)},reauthenticating:false,silentRenewing:false,authRequestSilent:false,token:'',expires:0,message:'',rememberedAccount:()=>({email:'test@example.com'}),renderProfile(){},render(){}};
vm.createContext(ctx);vm.runInContext(request,ctx);ctx.requestAccess(true);
assert.equal(requests[0].prompt,'');assert.equal(requests[0].login_hint,'test@example.com');
ctx.reauthenticating=false;ctx.requestAccess(false);assert.equal(requests[1].prompt,'select_account');
assert(source.includes('sectionReconnectAttempted=false;token=response.access_token;'),'successful auth permits renewal after a later expiry');
console.log('PASS: navigation reconnect, expiry, no load popup, cancel deduplication, account hint, no forced consent');
