/* PediaQ v1.3 Web Push device enrollment; answer history remains in sync.js. */
(function(){
  'use strict';
  const cfg=window.PEDIAQ_SUPABASE_CONFIG||{};
  const publicKey=cfg.vapidPublicKey||'';
  const slots=['07:00','12:00','22:00'];
  const localKey='pediaq-push-slots-v1';
  let status='通知を有効にするにはボタンを押してください / Tap Enable to receive reminders.';
  const $=s=>document.querySelector(s);
  function encoded(bytes){
    let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function decode(base64){
    const str=atob(base64.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-base64.length%4)%4));
    return Uint8Array.from(str,c=>c.charCodeAt(0));
  }
  async function hashEndpoint(endpoint){
    const value=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
    return [...new Uint8Array(value)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function preferences(){
    try{const v=JSON.parse(localStorage.getItem(localKey));if(Array.isArray(v))return v.filter(v=>slots.includes(v));}catch(e){}
    return slots.slice();
  }
  function selected(){
    return [...document.querySelectorAll('[data-push-slot]:checked')].map(x=>x.value);
  }
  function canPush(){
    return !!(window.isSecureContext&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&crypto?.subtle);
  }
  function renderPanel(){
    const root=$('#push-panel');if(!root)return;
    const user=window.PediaQSync?.getUser(),db=window.PediaQSync?.getClient();
    const mobile=/(iPhone|iPad|iPod)/.test(navigator.userAgent);
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
    const supported=canPush()&&!!publicKey;
    root.innerHTML='<h2>定時プッシュ通知 / Scheduled push notifications</h2>'+
      '<p>毎日7:00・12:00・22:00（日本時間）に演習の通知を送ります。タップすると該当する30問の第1問が開きます。<span class="en">Reminders arrive at 7 AM, noon, and 10 PM JST. Tap to open question one of the corresponding 30-question set.</span></p>'+
      '<div class="push-slot-grid">'+slots.map(x=>'<label class="push-slot"><input type="checkbox" data-push-slot value="'+x+'" '+(preferences().includes(x)?'checked':'')+'> '+x+'</label>').join('')+'</div>'+
      '<div class="actions"><button id="push-enable" class="btn" '+(!user||!db||!supported?'disabled':'')+'>通知を有効化 / Enable notifications</button>'+
      '<button id="push-save" class="btn secondary" '+(!user||!db||!supported?'disabled':'')+'>時間を保存 / Save times</button>'+
      '<button id="push-disable" class="btn secondary" '+(!user||!db||!supported?'disabled':'')+'>この端末で停止 / Disable on this device</button></div>'+
      '<p id="push-status" class="muted" aria-live="polite"></p>'+
      '<p class="muted">通知は端末ごとの設定です。iPhoneではSafariから「ホーム画面に追加」したPediaQを開いて許可してください。<span class="en">Each device must opt in. On iPhone, open PediaQ from its Home Screen icon after adding it through Safari.</span></p>';
    if(!user)status='先にGoogleまたはメールでログインしてください / Sign in with Google or email first.';
    else if(!supported)status='このブラウザでは通知を有効にできません / This browser does not support the required push features.';
    else if(mobile&&!standalone)status='iPhoneはホーム画面に追加したPediaQから設定してください / On iPhone, first open the installed Home Screen web app.';
    $('#push-status').textContent=status;
    for(const c of root.querySelectorAll('[data-push-slot]'))c.onchange=()=>{
      localStorage.setItem(localKey,JSON.stringify(selected()));
      status='時間を変更しました。「時間を保存」を押してください / Times changed. Tap Save times.';
      $('#push-status').textContent=status;
    };
    const enable=$('#push-enable'),save=$('#push-save'),disable=$('#push-disable');
    if(enable)enable.onclick=enablePush;
    if(save)save.onclick=savePush;
    if(disable)disable.onclick=disablePush;
  }
  function report(msg){status=msg;const el=$('#push-status');if(el)el.textContent=msg;}
  function identity(){
    const user=window.PediaQSync?.getUser(),db=window.PediaQSync?.getClient();
    if(!user||!db)throw new Error('Log in before enabling notifications.');
    return {user,db};
  }
  async function getDevice(){
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription();
    return {registration,subscription};
  }
  async function syncSubscription(subscription,enabled){
    const {user,db}=identity();
    const body=subscription.toJSON();
    if(!body.endpoint||!body.keys?.p256dh||!body.keys?.auth)throw new Error('Missing push encryption keys');
    const endpoint_hash=await hashEndpoint(body.endpoint);
    const row={user_id:user.id,endpoint_hash,endpoint:body.endpoint,
      p256dh:body.keys.p256dh,auth:body.keys.auth,
      slots:preferences(),enabled,updated_at:new Date().toISOString()};
    const {error}=await db.from('pediaq_push_subscriptions').upsert(row,{onConflict:'user_id,endpoint_hash'});
    if(error)throw error;
  }
  async function enablePush(){
    if(!canPush())return report('通知に非対応です / Push unsupported.');
    try{
      identity();
      // Permission request is initiated directly from the click, as browsers require.
      const permission=await Notification.requestPermission();
      if(permission!=='granted')return report('通知の許可が必要です / Notification permission is required.');
      const {registration,subscription:existing}=await getDevice();
      let subscription=existing;
      if(subscription&&subscription.options?.applicationServerKey){
        const old=new Uint8Array(subscription.options.applicationServerKey);
        if(encoded(old)!==publicKey){await subscription.unsubscribe();subscription=null;}
      }
      if(!subscription)subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:decode(publicKey)
      });
      await syncSubscription(subscription,true);
      report('この端末の通知を有効化しました / Notifications enabled on this device.');
    }catch(e){console.error('PediaQ push enable failed',e);report('設定に失敗しました / Setup failed: '+String(e.message||e));}
  }
  async function savePush(){
    try{
      identity();localStorage.setItem(localKey,JSON.stringify(selected()));
      const {subscription}=await getDevice();
      if(!subscription)return report('先に「通知を有効化」を押してください / Enable notifications first.');
      await syncSubscription(subscription,true);
      report('通知時刻を保存しました / Reminder times saved.');
    }catch(e){report('保存できませんでした / Could not save: '+String(e.message||e));}
  }
  async function disablePush(){
    try{
      const {user,db}=identity();
      const {subscription}=await getDevice();
      if(subscription){
        const endpoint_hash=await hashEndpoint(subscription.endpoint);
        const {error}=await db.from('pediaq_push_subscriptions').delete()
          .eq('user_id',user.id).eq('endpoint_hash',endpoint_hash);
        if(error)throw error;
        await subscription.unsubscribe();
      }
      report('この端末の通知を停止しました / Notifications disabled on this device.');
    }catch(e){report('停止できませんでした / Could not disable: '+String(e.message||e));}
  }
  window.PediaQPush={renderPanel};
})();
