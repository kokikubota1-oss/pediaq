const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let questions=[],index=0,selected=null,tab='quiz';let quizDomain='all';let remoteQuestionIds=new Set();const key='pediaq-pwa-progress-v1';let history=JSON.parse(localStorage.getItem(key)||'{}');

const practiceKey='pediaq-practice-session-v1';
let practiceSession=null;
function storePractice(){if(practiceSession)localStorage.setItem(practiceKey,JSON.stringify(practiceSession));}
function pickCurrent(){
  if(!practiceSession)return;
  while(practiceSession.cursor<practiceSession.ids.length){
    const id=practiceSession.ids[practiceSession.cursor];
    const at=questions.findIndex(q=>q.id===id&&!excluded(q));
    if(at>=0){index=at;selected=practiceSession.answers[id]?.answer??null;return;}
    practiceSession.cursor++;
  }
  index=-1;selected=null;storePractice();
}
function beginPractice(mode='scheduled',opts={}){
  const o={mode,...opts};
  if(mode==='random')o.seed=crypto.randomUUID();
  if(mode==='weak')o.seed=crypto.randomUUID();
  if(mode==='subject')o.seed=crypto.randomUUID();
  practiceSession=window.PediaQPractice.create(questions,history,o);
  storePractice();pickCurrent();tab='quiz';
  for(const n of ['quiz','progress','settings'])$('#tab-'+n).classList.toggle('active',n==='quiz');
  render();
}
function restorePractice(){
  const params=new URLSearchParams(location.search),slot=params.get('session'),jump=params.get('q');
  let saved=null;try{saved=JSON.parse(localStorage.getItem(practiceKey)||'null')}catch(e){}
  const clock=window.PediaQPractice.jstNow();
  if(slot&&window.PediaQPractice.slots.includes(slot)){
    if(!window.PediaQPractice.isValid(saved,questions)||saved.mode!=='scheduled'||saved.slot!==slot||saved.date!==clock.date)
      saved=window.PediaQPractice.create(questions,history,{mode:'scheduled',slot,date:clock.date});
  }else if(!window.PediaQPractice.isValid(saved,questions)){
    saved=window.PediaQPractice.create(questions,history,{mode:'scheduled'});
  }else if(saved.mode==='scheduled'){
    const fresh=window.PediaQPractice.create(questions,history,{mode:'scheduled'});
    if(saved.slot!==fresh.slot||saved.date!==fresh.date)saved=fresh;
  }
  if(jump){
    const q=questions.find(x=>x.id===jump&&!excluded(x));
    if(q&&(!saved.ids.includes(q.id))){
      saved=window.PediaQPractice.create(questions,history,{mode:'random',seed:'linked-'+jump});
      saved.ids=[q.id,...saved.ids.filter(x=>x!==q.id)].slice(0,30);saved.cursor=0;saved.answers={};
    }else if(q){saved.cursor=saved.ids.indexOf(q.id);}
  }
  practiceSession=saved;storePractice();pickCurrent();
}
function practiceControls(){
  const s=practiceSession,stats=s?window.PediaQPractice.tally(s,questions):null;
  const mode=s?.mode||'scheduled';
  const subjects=[['all','全分野 / All subjects'],['pediatrics','小児科全体 / All pediatrics'],['english','英語 / English'],...Array.from(new Set(questions.filter(q=>q.domain!=='Eiken1').map(q=>q.domain))).map(d=>[d,d])];
  return `<section class="card practice-controls"><h2>演習モード / Practice mode</h2>
    <div class="actions" role="group" aria-label="Practice mode">
      <button class="btn ${mode==='scheduled'?'':'secondary'}" data-mode="scheduled">定時 / Scheduled</button>
      <button class="btn ${mode==='random'?'':'secondary'}" data-mode="random">ランダム / Random</button>
      <button class="btn ${mode==='weak'?'':'secondary'}" data-mode="weak">弱点 / Weak areas</button>
      <button class="btn ${mode==='subject'?'':'secondary'}" data-mode="subject">分野別 / By subject</button>
    </div>
    <div class="actions session-slots">${window.PediaQPractice.slots.map(slot=>`<button class="btn ${mode==='scheduled'&&s?.slot===slot?'':'secondary'}" data-slot="${slot}">${slot}</button>`).join('')}</div>
    <label class="subject-label" for="subject-choice">分野 / Subject</label>
    <select id="subject-choice">${subjects.map(([id,name])=>`<option value="${esc(id)}" ${mode==='subject'&&s?.subject===id?'selected':''}>${esc(name)}</option>`).join('')}</select>
    <div class="muted">日本時間の7時・12時・22時を基準に問題セットを切り替えます。通知の自動配信は未実装です。 / Scheduled sets follow 7 AM, noon and 10 PM Japan time; push notifications are not yet available.</div>
    ${stats?`<p class="session-count">このセット / This set: ${stats.total}問 · 小児科 ${stats.pediatrics} / 英語 ${stats.english} · 完了 ${stats.completed}</p>`:''}
    <p class="muted">原則30問（小児科22＋英語8）。分野限定・問題不足・除外がある場合は少なくなります。 / Target: 30 questions (22 pediatrics + 8 English); subject filters, shortages and exclusions may reduce the count.</p>
  </section>`;
}
function bindPracticeControls(){
  for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{
    const mode=b.dataset.mode;
    const subject=mode==='subject'?$('#subject-choice').value:'all';
    beginPractice(mode,{subject});
  };
  for(const b of document.querySelectorAll('[data-slot]'))b.onclick=()=>beginPractice('scheduled',{slot:b.dataset.slot});
  const subject=$('#subject-choice');
  if(subject)subject.onchange=()=>beginPractice('subject',{subject:subject.value});
}
function nextPractice(){
  if(!practiceSession)return;
  practiceSession.cursor++;
  storePractice();pickCurrent();render();
}

const persist=()=>{localStorage.setItem(key,JSON.stringify(history));window.PediaQSync?.schedule();};
const applyCloudHistory=next=>{history=next;localStorage.setItem(key,JSON.stringify(history));if(questions.length)render();};
const excluded=q=>!!history[qid(q)]?.excluded;
const activeIndices=()=>questions.map((q,i)=>excluded(q)?-1:i).filter(i=>i>=0);
function chooseAvailable(preferred){const a=activeIndices();return a.length?(a.includes(preferred)?preferred:a[0]):-1;}
function excludeCurrent(){const q=questions[index];if(!q)return;history[qid(q)]??={attempts:[]};history[qid(q)].excluded=true;history[qid(q)].excludedUpdatedAt=new Date().toISOString();persist();if(practiceSession){const ix=practiceSession.cursor;const removed=practiceSession.ids.splice(ix,1)[0];delete practiceSession.answers[removed];const oldIds=new Set(practiceSession.ids);const source=questions.find(v=>v.id===removed);const alternate=questions.find(v=>!excluded(v)&&!oldIds.has(v.id)&&(!source||(v.domain==='Eiken1')===(source.domain==='Eiken1')));if(alternate)practiceSession.ids.splice(ix,0,alternate.id);storePractice();pickCurrent();}else{selected=null;index=chooseAvailable(nextDue());}render();}
function restoreQuestion(id){if(history[id]){history[id].excluded=false;history[id].excludedUpdatedAt=new Date().toISOString();persist();if(practiceSession)pickCurrent();else if(index<0)index=chooseAvailable(0);render();}}
const jpdate=d=>new Date(d).toLocaleString('ja-JP');
const today=()=>new Date().toLocaleDateString('sv-SE');
const session=()=>{const requested=new URLSearchParams(location.search).get('session');if(['07:00','12:00','22:00'].includes(requested))return requested;let h=new Date().getHours();return h<12?'07:00':h<22?'12:00':'22:00'};
function dailyIndex(){const seed=Number(today().replaceAll('-',''))+({'07:00':0,'12:00':11,'22:00':23}[session()]);const a=activeIndices();return a.length?a[seed%a.length]:-1}
function linkedIndex(){const id=new URLSearchParams(location.search).get('q');if(!id)return dailyIndex();const found=questions.findIndex(q=>q.id===id);return found<0||excluded(questions[found])?dailyIndex():found}
function sessionLink(s){const u=new URL(location.href);u.searchParams.delete('q');u.searchParams.set('session',s);return u.href}
function qid(q){return q.id||`q${index+1}`}
function record(q,answer){const id=qid(q),correct=answer!=='E'&&'ABCD'[q.correct]===answer;history[id]??={attempts:[]};history[id].attempts.push({answer,correct,time:new Date().toISOString(),rating:null,syncId:crypto.randomUUID(),ratingUpdatedAt:new Date().toISOString()});persist()}
function due(q){if(excluded(q))return false;const a=history[qid(q)]?.attempts?.at(-1);if(!a)return true;let days=a.rating==='easy'?30:a.rating==='normal'?7:a.rating==='unsure'?3:a.correct?7:1;return Date.now()-new Date(a.time).getTime()>=days*86400000}
function nextDue(){const i=questions.findIndex((q,j)=>j!==index&&due(q));if(i>=0)return i;const a=activeIndices();return a.length?(a.find(i=>i!==index)??a[0]):-1}
function nav(t){tab=t;for(let n of ['quiz','progress','settings'])$('#tab-'+n).classList.toggle('active',t===n);render()}
function render(){if(!questions.length)return;const c=$('#content');if(tab==='progress'){let attempts=Object.values(history).flatMap(v=>v.attempts||[]),right=attempts.filter(x=>x.correct).length;let missed=questions.filter(q=>!excluded(q)&&history[qid(q)]?.attempts?.at(-1)?.correct===false).length;c.innerHTML=`<section class="card" id="sync-panel"></section><section class="card"><h2>学習記録 / Learning progress</h2><p>回答数 / Answers: <b>${attempts.length}</b></p><p>正答率 / Accuracy: <b>${attempts.length?Math.round(right/attempts.length*100):0}%</b></p><p>直近で誤答 / Most recently missed: <b>${missed}</b></p><p>復習対象 / Due for review: <b>${questions.filter(due).length}</b></p><p>出題から除外 / Excluded: <b>${questions.filter(excluded).length}</b></p><p class="muted">ログインするまではこの端末に保存されます。<br>History stays local until cloud sign-in is configured and enabled.</p><button class="btn" id="export">履歴を保存 / Export history</button><h3>除外した問題 / Excluded questions</h3><div id="excluded-list">${questions.filter(excluded).map(q=>`<p><button class="btn secondary" data-restore="${esc(qid(q))}">復活 / Restore</button> ${esc(q.ja.slice(0,60))}</p>`).join('')||'<p class="muted">なし / None</p>'}</div></section>`;for(const b of c.querySelectorAll('[data-restore]'))b.onclick=()=>restoreQuestion(b.dataset.restore);window.PediaQSync?.renderPanel();$('#export').onclick=()=>{const b=new Blob([JSON.stringify(history,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='pediaq-history.json';a.click();URL.revokeObjectURL(a.href)};return}
if(tab==='settings'){c.innerHTML=`<section class="card" id="sync-panel"></section><section class="card"><h2>定時出題 / Scheduled quizzes</h2><div class="pill">07:00</div><div class="pill">12:00</div><div class="pill">22:00</div><p>この時刻にはChatGPTの既存タスクが出題します。PediaQへの直接通知・自動起動はまだありません。<br><span class="en">Your existing ChatGPT tasks deliver quizzes at these times. Direct PediaQ notifications and automatic launching are not available yet.</span></p><p>PediaQの定時演習は、日本時間の7時・12時・22時ごとに30問のセットを用意し、開いたときに選択します。サイトからのプッシュ通知はまだありません。<br><span class="en">PediaQ prepares a 30-question practice set for each 7 AM, noon, and 10 PM Japan-time slot when opened. Website push notifications are not yet available.</span></p><button class="btn" id="daily">現在の定時30問へ / Current 30-question session</button><p>定時クイズへのリンク / Scheduled quiz links</p><div class="actions"><button class="btn secondary" data-session="07:00">07:00</button><button class="btn secondary" data-session="12:00">12:00</button><button class="btn secondary" data-session="22:00">22:00</button></div><p class="muted" id="linkmsg">各ボタンでリンクをコピーできます。 / Tap a time to copy its direct link.</p></section><section class="card"><h2>ChatGPT問題の取り込み / Import ChatGPT questions</h2><p class="muted">ChatGPTから問題をJSON形式でコピーして取り込めます。自動同期ではありません。<br>Copy JSON-formatted questions from ChatGPT to import them manually; this is not automatic sync.</p><textarea id="import" placeholder='[{"id":"new1","domain":"医学","level":3,"ja":"問題","en":"Question","options":[{"ja":"選択肢","en":"Option"},...],"correct":0,"exja":"解説","exen":"Explanation"}]'></textarea><button class="btn" id="load">JSONを取り込む / Import JSON</button><p id="importmsg" class="muted"></p></section><section class="card"><h2>ホーム画面への追加 / Add to Home Screen</h2><p>HTTPSで公開した後、iPhoneのSafariで共有 → ホーム画面に追加を選択してください。<br><span class="en">After HTTPS hosting, open the site in iPhone Safari, tap Share, then Add to Home Screen.</span></p></section>`;window.PediaQSync?.renderPanel();$('#daily').onclick=()=>beginPractice('scheduled');for(const b of c.querySelectorAll('[data-session]'))b.onclick=async()=>{const link=sessionLink(b.dataset.session);try{await navigator.clipboard.writeText(link);$('#linkmsg').textContent='コピーしました / Copied: '+link}catch(e){$('#linkmsg').textContent=link}};$('#load').onclick=()=>{try{const arr=JSON.parse($('#import').value);if(!Array.isArray(arr)||!arr.length||!arr.every(q=>q.id&&q.ja&&q.en&&q.options?.length===4&&(!!q.comic||q.images?.length===4)&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4))throw Error('Invalid question schema');const ids=new Set(questions.map(q=>qid(q)));for(const q of arr)if(!ids.has(q.id)){questions.push(q);ids.add(q.id)}localStorage.setItem('pediaq-imported',JSON.stringify([...JSON.parse(localStorage.getItem('pediaq-imported')||'[]'),...arr.filter(x=>!remoteQuestionIds.has(x.id))].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i)));$('#importmsg').textContent=`${arr.length}件を確認 / Imported or verified ${arr.length} questions`}catch(e){$('#importmsg').textContent='JSON形式を確認してください / Please check JSON format: '+e.message}};return}
if(practiceSession){pickCurrent();}else if(index<0||excluded(questions[index]))index=chooseAvailable(0);if(index<0){const stats=practiceSession?window.PediaQPractice.tally(practiceSession,questions):null;c.innerHTML=practiceControls()+`<section class="card"><h2>セット完了 / Session complete</h2><p>${stats?stats.completed:0}問回答 · 正答 ${stats?stats.correct:0}問 / ${stats?stats.completed:0} answered, ${stats?stats.correct:0} correct</p><button class="btn" id="session-again">新しいセットを開始 / Start another set</button></section>`;bindPracticeControls();$('#session-again').onclick=()=>beginPractice(practiceSession?.mode||'random',{slot:practiceSession?.slot,subject:practiceSession?.subject});return;}const q=questions[index],a=history[qid(q)]?.attempts?.at(-1),locked=selected!==null;let opts=q.options.map((o,i)=>{const letter='ABCD'[i];return `<button class="option ${selected===letter?(i===q.correct?'selected':'wrong'):''}" data-a="${letter}" ${locked?'disabled':''}>${letter}. ${esc(o.ja)}<div class="en">${esc(o.en)}</div></button>`}).join('');opts+=`<button class="option ${selected==='E'?'wrong':''}" data-a="E" ${locked?'disabled':''}>E. わからない<div class="en">I don't know</div></button>`;
c.innerHTML=practiceControls()+`<section class="card"><div class="muted">第${practiceSession.cursor+1}問 / Question ${practiceSession.cursor+1} of ${practiceSession.ids.length} · ${esc(q.domain)} · Level ${q.level}</div><h2>${esc(q.ja)}</h2><p class="en">${esc(q.en)}</p><p class="muted">回答するまで解説は表示されません。 / The explanation is hidden until you answer.</p>${opts}<div id="feedback" ${locked?'style="display:block"':''}></div><div class="actions"><button class="btn secondary" id="next" ${locked?'':'disabled'}>次の問題 / Next question</button><button class="btn secondary" id="today">今日の問題 / Daily question</button><button class="btn secondary" id="exclude">出題から除外 / Remove from rotation</button></div></section>`;
bindPracticeControls();for(const el of c.querySelectorAll('[data-a]'))el.onclick=()=>{selected=el.dataset.a;record(q,selected);if(practiceSession){practiceSession.answers[q.id]={answer:selected,correct:selected==='ABCD'[q.correct]};storePractice();}render()};$('#next').onclick=()=>nextPractice();$('#today').onclick=()=>beginPractice('scheduled');$('#exclude').onclick=()=>{if(confirm('この問題を今後の出題から除外しますか？ 学習履歴は残り、記録画面から復活できます。 / Remove this question from future quizzes? History is preserved and you can restore it from Progress.'))excludeCurrent()};if(locked){const correct='ABCD'[q.correct],good=selected===correct;let extra=Array.isArray(q.images)&&q.images.length===4?'<div class="image-grid">'+q.images.map((im,i)=>'<figure class="image-figure"><img loading="lazy" class="option-image" src="'+esc(im.url)+'" alt="Option '+ 'ABCD'[i]+' reference image"><figcaption>'+ 'ABCD'[i]+'. '+esc(q.options[i].ja)+'<div class="en">'+esc(q.options[i].en)+'</div><small>© '+esc(im.creator)+' · '+esc(im.license)+' · <a href="'+esc(im.source)+'" target="_blank" rel="noopener noreferrer">Source / 出典</a></small></figcaption></figure>').join('')+'</div>':q.comic?'<img class="comic" src="'+esc(q.comic)+'" alt="Dedicated four-panel manga for this question">':'<div class="panel">既存問題の画像は準備中です。 / Image for this legacy question is being prepared.</div>';$('#feedback').innerHTML=`<div class="status">${good?'正解 / Correct':'復習しよう / Review'} · 正答 / Answer: ${correct}</div><h3>核心の解説 / Core reasoning</h3><p class="explain-ja">${esc(q.exja)}</p><p class="explain-en">${esc(q.exen)}</p><h3>全選択肢の詳しい解説 / Detailed explanations for every option</h3><div class="rationale-list">${q.options.map((o,i)=>`<section class="rationale ${i===q.correct?'rationale-correct':''}"><h4>${'ABCD'[i]}. ${esc(o.ja)} <span class="rationale-verdict">${i===q.correct?'正答 / Correct':'誤答 / Incorrect'}</span></h4><p class="en">${esc(o.en)}</p><p class="explain-ja">${esc(o.whyja||'この選択肢の個別解説は未収録です。 / Individual rationale pending.')}</p><p class="explain-en">${esc(o.whyen||'An individual explanation for this option has not been added yet.')}</p></section>`).join('')}</div><h3>選択肢別の画像・漫画 / Option images and manga</h3>${extra}<p class="muted">復習の間隔 / Review interval</p><div class="actions"><button class="btn secondary" data-rating="unsure">自信なし / Unsure · 3日</button><button class="btn secondary" data-rating="normal">普通 / Normal · 7日</button><button class="btn secondary" data-rating="easy">簡単 / Easy · 30日</button></div><p class="muted" id="rated"></p>`;for(const b of c.querySelectorAll('[data-rating]'))b.onclick=()=>{history[qid(q)].attempts.at(-1).rating=b.dataset.rating;history[qid(q)].attempts.at(-1).ratingUpdatedAt=new Date().toISOString();persist();$('#rated').textContent='保存しました / Saved'}}}
for(const t of ['quiz','progress','settings'])$('#tab-'+t).onclick=()=>nav(t);
fetch('questions.json').then(r=>{if(!r.ok)throw Error('Cannot load questions');return r.json()}).then(q=>{const remoteIds=new Set(q.map(x=>x.id));remoteQuestionIds=new Set(q.map(x=>x.id));questions=q.concat(JSON.parse(localStorage.getItem('pediaq-imported')||'[]').filter(x=>!remoteIds.has(x.id)&&(x.comic||x.images?.length===4)));restorePractice();render();window.PediaQSync?.init({getHistory:()=>history,setHistory:applyCloudHistory})}).catch(e=>{$('#content').innerHTML=`<section class="card"><h2>読み込みに失敗しました / Failed to load</h2><p>${esc(e.message)}</p><p>HTTPS公開版で開いてください。 / Open the HTTPS-hosted version.</p></section>`});
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
