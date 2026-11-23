import { sendPushNotification } from "npm:@mmmike/web-push@1.5.0/send";
const url=Deno.env.get("SUPABASE_URL")||"";
const role=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const headers={"Content-Type":"application/json","apikey":role,"Authorization":"Bearer "+role};
const project="https://kokikubota1-oss.github.io/pediaq/";
const allowed=(endpoint:string)=>{
 try {
  const u=new URL(endpoint);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  const h=u.hostname.toLowerCase();
  return h==="fcm.googleapis.com"||h==="android.googleapis.com"||
    h==="updates.push.services.mozilla.com"||h==="push.services.mozilla.com"||
    h==="web.push.apple.com"||h==="api.push.apple.com"||
    (h.endsWith(".push.apple.com")&&h!=="push.apple.com")||
    (h.endsWith(".notify.windows.com")&&h!=="notify.windows.com");
 }catch{return false;}
};
async function rpc(name:string,body:Record<string,unknown>){
 const r=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers,body:JSON.stringify(body)});
 if(!r.ok)throw new Error("RPC "+name+" failed: "+r.status);
 return r.json();
}
async function subscriptions(start:number){
 const q=new URL(url+"/rest/v1/pediaq_push_subscriptions");
 q.searchParams.set("select","user_id,endpoint_hash,endpoint,p256dh,auth,slots");
 q.searchParams.set("enabled","eq.true");
 const r=await fetch(q,{headers:{...headers,"Range-Unit":"items","Range":start+"-"+(start+499)}});
 if(!r.ok)throw new Error("Subscription fetch failed "+r.status);
 return r.json();
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Not found",{status:404});
 if(!url||!role)return new Response("Server not configured",{status:503});
 let body:{date?:string;slot?:string;signature?:string};
 try{body=await req.json();}catch{return new Response("Bad payload",{status:400});}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date||"")||
     !["07:00","12:00","22:00"].includes(body.slot||"")||
     !/^[0-9a-f]{64}$/.test(body.signature||""))return new Response("Unauthorized",{status:401});
 try {
  const claim=await rpc("pediaq_claim_push_job",{p_date:body.date,p_slot:body.slot,p_signature:body.signature});
  if(claim!==true)return new Response("Unauthorized or already delivered",{status:403});
  const keys=await rpc("pediaq_push_server_config",{});
  if(!keys?.publicKey||!keys?.privateKey)throw new Error("VAPID configuration missing");
  let sent=0,failed=0,invalid=0,scanned=0;
  for(let offset=0;;offset+=500){
   const page=await subscriptions(offset);
   for(const sub of page){
    if(!Array.isArray(sub.slots)||!sub.slots.includes(body.slot))continue;
    scanned++;
    let status="failed";
    if(!allowed(sub.endpoint)||!sub.p256dh||!sub.auth){invalid++;status="invalid_endpoint";}
    else {
      try {
        const success=await sendPushNotification(
          {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
          {title:"PediaQ — "+body.slot+" の30問 / 30 questions",
           body:"小児科22問＋英語8問を始めよう！ / Start 22 pediatrics + 8 English questions.",
           icon:project+"icon-192.png",
           tag:"pediaq-"+body.date+"-"+body.slot,
           data:{url:project+"?session="+encodeURIComponent(body.slot)+"&date="+body.date+"&start=1"}},
          {publicKey:keys.publicKey,privateKey:keys.privateKey,subject:"https://kokikubota1-oss.github.io"},
          {ttl:3600}
        );
        status=success?"sent":"failed";if(success)sent++;else failed++;
      }catch(e){failed++;status="failed";}
    }
    try {await rpc("pediaq_log_push_result",{p_date:body.date,p_slot:body.slot,p_user_id:sub.user_id,p_endpoint_hash:sub.endpoint_hash,p_status:status});}catch(e){console.error("Log write failed",e);}
   }
   if(page.length<500)break;
  }
  console.info("PediaQ push",body.date,body.slot,{sent,failed,invalid,scanned});
  return Response.json({ok:true,sent,failed,invalid,scanned});
 }catch(e){console.error("PediaQ push delivery error",String(e));return new Response("Internal error",{status:500});}
});
