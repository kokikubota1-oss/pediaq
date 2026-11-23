const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const planner=require('../practice.js');
const questions=JSON.parse(fs.readFileSync('questions.json','utf8'));
const appSource=fs.readFileSync('app.js','utf8');
const workerSource=fs.readFileSync('sw.js','utf8');
const saved=planner.create(questions,{}, {mode:'random',seed:'previous-session'});
saved.cursor=9;
const data=new Map([['pediaq-practice-session-v1',JSON.stringify(saved)],['pediaq-pwa-progress-v1',JSON.stringify({'Q001':{attempts:[{answer:'B',correct:true,time:new Date().toISOString()}]}})]]);
const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)};
const nodes=new Map();
const getNode=key=>{
 if(!nodes.has(key))nodes.set(key,{
   innerHTML:'',textContent:'',classList:{toggle:()=>{}},
   querySelectorAll:()=>[],value:'all',onclick:null,onchange:null
 });
 return nodes.get(key);
};
const document={querySelector:getNode,querySelectorAll:()=>[]};
const context={
 document,localStorage,window:{PediaQPractice:planner,PediaQSync:{schedule(){},renderPanel(){},init(){}},PediaQPush:{renderPanel(){}}},
 fetch:async()=>({ok:true,json:async()=>questions}),
 location:{search:'?session=07%3A00&date=2026-11-23&start=1',protocol:'http:',href:'https://kokikubota1-oss.github.io/pediaq/',origin:'https://kokikubota1-oss.github.io',pathname:'/pediaq/'},
 navigator:{},URL,URLSearchParams,crypto:{randomUUID:()=> 'test-id'},
 confirm:()=>true,console,Date,Intl,setTimeout,clearTimeout
};
vm.createContext(context);
vm.runInContext(appSource,context);
setImmediate(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 const session=vm.runInContext('practiceSession',context);
 assert.equal(session.mode,'scheduled');
 assert.equal(session.slot,'07:00');
 assert.equal(session.date,'2026-11-23');
 assert.equal(session.cursor,0);
 assert.equal(Object.keys(session.answers).length,0);
 assert.equal(session.ids.length,30);
 assert.equal(session.ids.filter(id=>questions.find(q=>q.id===id).domain==='Eiken1').length,8);
 assert.equal(JSON.parse(data.get('pediaq-pwa-progress-v1')).Q001.attempts.length,1);
 assert.ok(getNode('#content').innerHTML.includes('演習モード'));

 const listeners={};let shown=null,opened=null;
 const worker={
  location:{origin:'https://kokikubota1-oss.github.io'},
  addEventListener(name,cb){listeners[name]=cb;},
  registration:{showNotification:async(title,opts)=>{shown={title,opts};}},
  clients:{matchAll:async()=>[],openWindow:async(url)=>{opened=url;}}
 };
 const cache={open:()=>({}),keys:async()=>[],match:async()=>{}};
 vm.runInNewContext(workerSource,{self:worker,caches:cache,URL,console,fetch:()=>{},Promise});
 const pushData={title:'PediaQ',body:'30 questions',data:{url:'https://kokikubota1-oss.github.io/pediaq/?session=07%3A00&date=2026-11-23&start=1'}};
 let pushWait=null;listeners.push({data:{json:()=>pushData},waitUntil:p=>pushWait=p});
 await pushWait;
 assert.equal(shown.opts.data.url,pushData.data.url);
 let clickWait=null;
 listeners.notificationclick({notification:{data:{url:pushData.data.url},close(){}},waitUntil:p=>clickWait=p});
 await clickWait;
 assert.equal(opened,pushData.data.url);
 console.log('PediaQ v1.3 push deep-link and service worker tests passed');
}).catch(e=>{console.error(e);process.exitCode=1});
