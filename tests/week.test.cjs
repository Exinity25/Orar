const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},localStorage:{getItem:()=>null}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../student-planner.js'),'utf8'),ctx);const w=ctx.window.OrarWeek;
const s={anchor:'2026-10-12',weekNumber:3,parity:'IMPARĂ'};
for(const d of ['2026-10-12','2026-10-16','2026-10-17','2026-10-18']){assert.equal(w.number(s,d),3);assert.equal(w.parity(s,d),'IMPARĂ');}
assert.equal(w.number(s,'2026-10-19'),4);assert.equal(w.parity(s,'2026-10-19'),'PARĂ');
assert.equal(w.number(s,'2026-10-26'),5);assert.equal(w.number({anchor:'2026-12-28',weekNumber:10},'2027-01-04'),11);
assert.equal(w.number({anchor:'2026-03-23',weekNumber:3},'2026-03-30'),4);
for(let i=0;i<7;i++)assert.equal(w.day(new Date(2026,9,12+i,12)),i<5?i:0);
assert.equal(w.parity({anchor:'2026-10-12',parity:'PARĂ'},'2026-10-19'),'IMPARĂ');
const inline=[...fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];inline.forEach(x=>new vm.Script(x[1]));
console.log('PASS: week rollover, parity, weekends, year boundary, DST, legacy parity, inline JS syntax');
