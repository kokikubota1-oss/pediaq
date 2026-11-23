/* PediaQ v1.2 session planner. Pure, deterministic functions except initial random seed. */
(function(root,factory){
  const planner=factory();
  if(typeof module==='object'&&module.exports) module.exports=planner;
  root.PediaQPractice=planner;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LIMIT=30, PEDS=22, ENGLISH=8;
  const slots=['07:00','12:00','22:00'];
  const validModes=['scheduled','random','weak','subject'];
  const domainOf=q=>q.domain==='Eiken1'?'english':'pediatrics';
  function hash(str){let x=2166136261;for(let i=0;i<str.length;i++){x^=str.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0;}
  function random(seed){let x=seed>>>0;return function(){x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  function shuffle(list,rng){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function jstNow(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const v=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const hour=Number(v.hour),minute=Number(v.minute);
    return {date:v.year+'-'+v.month+'-'+v.day,slot:hour>=22?'22:00':hour>=12?'12:00':hour>=7?'07:00':'22:00',beforeMorning:hour<7,hour,minute};
  }
  function weakScore(q,history,nowMs){
    const attempts=history[q.id]?.attempts||[];
    if(!attempts.length)return 25;
    const last=attempts[attempts.length-1];
    const age=(nowMs-Date.parse(last.time||0))/86400000;
    const rating=last.rating;
    const interval=rating==='easy'?30:rating==='normal'?7:rating==='unsure'?3:last.correct?7:1;
    const overdue=age>=interval;
    return (last.correct?0:100)+(rating==='unsure'?70:0)+(overdue?55:0)+
      Math.min(30,Math.max(0,age/interval*7));
  }
  function pick(pool,count,mode,rng,history,nowMs){
    let sorted=shuffle(pool,rng);
    if(mode==='weak')sorted=sorted.map((q,i)=>({q,i,score:weakScore(q,history,nowMs)}))
      .sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.q);
    return sorted.slice(0,count);
  }
  function create(questions,history={},options={}){
    const mode=validModes.includes(options.mode)?options.mode:'scheduled';
    const clock=jstNow();
    const date=options.date||clock.date;
    const slot=slots.includes(options.slot)?options.slot:clock.slot;
    const subject=options.subject||'all';
    const seed=options.seed||hash(mode+'|'+date+'|'+slot+'|'+subject+'|pediaq-v12');
    const rng=random(hash(String(seed)));
    const eligible=questions.filter(q=>!history[q.id]?.excluded);
    let chosen=[];
    if(mode==='subject'&&subject!=='all'){
      const filtered=eligible.filter(q=>subject==='english'?domainOf(q)==='english':subject==='pediatrics'?domainOf(q)==='pediatrics':q.domain===subject);
      chosen=pick(filtered,LIMIT,mode,rng,history,Date.now());
    }else{
      const ped=pick(eligible.filter(q=>domainOf(q)==='pediatrics'),PEDS,mode,rng,history,Date.now());
      const english=pick(eligible.filter(q=>domainOf(q)==='english'),ENGLISH,mode,rng,history,Date.now());
      chosen=ped.concat(english);
      if(chosen.length<LIMIT){
        const ids=new Set(chosen.map(q=>q.id));
        chosen=chosen.concat(pick(eligible.filter(q=>!ids.has(q.id)),LIMIT-chosen.length,mode,rng,history,Date.now()));
      }
      chosen=shuffle(chosen,rng);
    }
    return {version:1,mode,slot,date,subject,seed,ids:chosen.map(q=>q.id),cursor:0,answers:{},createdAt:new Date().toISOString()};
  }
  function isValid(s,questions){
    if(!s||s.version!==1||!validModes.includes(s.mode)||!Array.isArray(s.ids)||
      s.ids.length>LIMIT||!Number.isInteger(s.cursor)||s.cursor<0||typeof s.answers!=='object'||!s.answers)return false;
    const valid=new Set(questions.map(q=>q.id));
    return s.ids.every(id=>valid.has(id))&&new Set(s.ids).size===s.ids.length;
  }
  function tally(s,questions){
    const byId=new Map(questions.map(q=>[q.id,q]));
    const items=s.ids.map(id=>byId.get(id)).filter(Boolean);
    const completed=items.filter(q=>s.answers[q.id]).length;
    const correct=items.filter(q=>s.answers[q.id]?.correct).length;
    return {total:items.length,completed,correct,pediatrics:items.filter(q=>domainOf(q)==='pediatrics').length,english:items.filter(q=>domainOf(q)==='english').length};
  }
  return {LIMIT,PEDS,ENGLISH,slots,validModes,hash,jstNow,weakScore,create,isValid,tally};
});
