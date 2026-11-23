const assert=require('node:assert/strict');
const planner=require('../practice.js');
const questions=[
  ...Array.from({length:30},(_,i)=>({id:'P'+i,domain:['Neo','ID','Neuro','Renal','Cardio','Resp','Endo','GI','Heme','Emergency'][i%10]})),
  ...Array.from({length:10},(_,i)=>({id:'E'+i,domain:'Eiken1'}))
];
const history={};
let scheduled=planner.create(questions,history,{mode:'scheduled',date:'2026-11-23',slot:'07:00'});
let other=planner.create(questions,history,{mode:'scheduled',date:'2026-11-23',slot:'07:00'});
assert.deepEqual(scheduled.ids,other.ids,'same daily slot must be stable');
assert.equal(scheduled.ids.length,30);
assert.equal(new Set(scheduled.ids).size,30);
assert.deepEqual(
  {p:planner.tally(scheduled,questions).pediatrics,e:planner.tally(scheduled,questions).english},
  {p:22,e:8}
);
const noon=planner.create(questions,history,{mode:'scheduled',date:'2026-11-23',slot:'12:00'});
assert.notDeepEqual(scheduled.ids,noon.ids,'different slots should provide different ordering');
const random=planner.create(questions,history,{mode:'random',seed:'random-test'});
assert.equal(random.ids.length,30);
assert.deepEqual({p:planner.tally(random,questions).pediatrics,e:planner.tally(random,questions).english},{p:22,e:8});
const subject=planner.create(questions,history,{mode:'subject',subject:'ID',seed:'id-test'});
assert.equal(subject.ids.length,3);
assert.ok(subject.ids.every(id=>questions.find(q=>q.id===id).domain==='ID'));
const english=planner.create(questions,history,{mode:'subject',subject:'english',seed:'en-test'});
assert.equal(english.ids.length,10);
const excluded={'P0':{excluded:true},'E0':{excluded:true}};
const reduced=planner.create(questions,excluded,{mode:'random',seed:'exclude-test'});
assert.ok(!reduced.ids.includes('P0')&&!reduced.ids.includes('E0'));
assert.equal(reduced.ids.length,30);
assert.deepEqual({p:planner.tally(reduced,questions).pediatrics,e:planner.tally(reduced,questions).english},{p:22,e:8});
const now=new Date().toISOString();
const weakHistory={'P0':{attempts:[{time:now,correct:false,rating:'unsure'}]},'P1':{attempts:[{time:now,correct:true,rating:'easy'}]}};
const weak=planner.create(questions,weakHistory,{mode:'weak',seed:'weak-test'});
assert.ok(weak.ids.includes('P0'),'missed uncertain question must be included');
assert.ok(!weak.ids.includes('P1'),'strong easy answer should be excluded when enough alternatives exist');
assert.ok(planner.weakScore(questions[0],weakHistory,Date.now())>planner.weakScore(questions[1],weakHistory,Date.now()));
assert.equal(planner.isValid(scheduled,questions),true);
assert.equal(planner.isValid({...scheduled,ids:['P0','P0']},questions),false);
assert.equal(planner.jstNow(new Date('2026-11-22T22:15:00Z')).slot,'07:00');
assert.equal(planner.jstNow(new Date('2026-11-23T03:15:00Z')).slot,'12:00');
assert.equal(planner.jstNow(new Date('2026-11-23T13:15:00Z')).slot,'22:00');
console.log('PediaQ v1.2 practice planner tests passed');
