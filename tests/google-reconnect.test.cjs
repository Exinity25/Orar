const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../classroom-view.js'), 'utf8');
const section = source.slice(source.indexOf('    const ensureGoogleSessionForSection=()=>{'), source.indexOf("    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensureFreshGoogleSession();"));
function scenario(overrides = {}) {
  const calls = [];
  const ctx = { token:'', expires:0, client:{}, navigator:{userActivation:{isActive:true}},
    reauthenticating:false, silentRenewing:false, 
    prepareSignIn(){}, rememberedAccount:()=>({email:'test@example.com'}),
    clearSession(){ctx.token='';}, requestAccess:remembered=>calls.push(remembered), ...overrides };
  vm.createContext(ctx);
  vm.runInContext(section + '\nthis.enter=ensureGoogleSessionForSection;', ctx);
  return {ctx,calls};
}
for(const overrides of [
  {}, {navigator:{userActivation:{isActive:false}}}, {navigator:{}},
  {rememberedAccount:()=>null}, {client:null}, {reauthenticating:true},
  {silentRenewing:true}, {token:'valid',expires:Date.now()+60000},
  {token:'expired',expires:1}
]) {
  const s=scenario(overrides);
  s.ctx.enter();s.ctx.enter();
  assert.equal(s.calls.length,0,'section entry must never open Google authorization');
  if(overrides.token==='valid')assert.equal(s.ctx.token,'valid','reuse a valid session');
  if(overrides.token==='expired')assert.equal(s.ctx.token,'','clear expired credentials');
}
const request=source.slice(source.indexOf('    function requestAccess('),source.indexOf("    page.addEventListener('click',e=>{\n      const preview="));
const requests=[];
const ctx={client:{requestAccessToken:options=>requests.push(options)},reauthenticating:false,silentRenewing:false,authRequestSilent:false,token:'',expires:0,message:'',rememberedAccount:()=>({email:'test@example.com'}),renderProfile(){},render(){}};
vm.createContext(ctx);vm.runInContext(request,ctx);ctx.requestAccess(true);
assert.equal(requests[0].prompt,'');assert.equal(requests[0].login_hint,'test@example.com');
ctx.reauthenticating=false;ctx.requestAccess(false);assert.equal(requests[1].prompt,'select_account');
console.log('PASS: no navigation popup, valid session reuse, expiry cleanup, explicit reconnect and account selection');
