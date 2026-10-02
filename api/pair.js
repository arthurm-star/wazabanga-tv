const crypto = require("crypto");

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 600;

async function redis(command) {
  if (!redisUrl || !redisToken) throw new Error("Pairing storage is not configured");
  const r = await fetch(redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error("Storage request failed");
  const j = await r.json();
  return j.result;
}
async function getJson(key){ const v=await redis(["GET",key]); return v?JSON.parse(v):null; }
async function setJson(key,value,ttl=TTL){ await redis(["SET",key,JSON.stringify(value),"EX",String(ttl)]); }
function six(){ return String(crypto.randomInt(0,1000000)).padStart(6,"0"); }
function json(res,status,body){ res.status(status).setHeader("Content-Type","application/json"); res.setHeader("Cache-Control","no-store"); res.end(JSON.stringify(body)); }

module.exports = async (req,res) => {
  try {
    if(req.method==="POST"){
      const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
      if(body.action==="create"){
        const id=crypto.randomBytes(12).toString("hex"), secret=crypto.randomBytes(24).toString("hex");
        let code, existing;
        do { code=six(); existing=await redis(["GET","wz:code:"+code]); } while(existing);
        await setJson("wz:pair:"+id,{id,secret,code,status:"waiting",createdAt:Date.now()});
        await redis(["SET","wz:code:"+code,id,"EX",String(TTL)]);
        return json(res,200,{id,secret,code,expiresIn:TTL});
      }
      if(body.action==="submit"){
        const code=String(body.code||"").replace(/\D/g,"");
        const name=String(body.name||"My Playlist").trim().slice(0,80);
        const url=String(body.url||"").trim();
        if(!/^\d{6}$/.test(code)) return json(res,400,{error:"Enter the 6-digit code shown on your TV."});
        let parsed; try{parsed=new URL(url)}catch{ return json(res,400,{error:"Enter a valid playlist URL."}); }
        if(!["http:","https:"].includes(parsed.protocol)) return json(res,400,{error:"Playlist URL must use HTTP or HTTPS."});
        const id=await redis(["GET","wz:code:"+code]); if(!id)return json(res,404,{error:"That pairing code has expired or is not valid."});
        const session=await getJson("wz:pair:"+id); if(!session)return json(res,404,{error:"Pairing session expired."});
        session.status="ready";session.name=name||"My Playlist";session.url=url;session.submittedAt=Date.now();
        await setJson("wz:pair:"+id,session,TTL);
        return json(res,200,{ok:true});
      }
      return json(res,400,{error:"Unknown action."});
    }
    if(req.method==="GET" && req.query.action==="poll"){
      const id=String(req.query.id||""), secret=String(req.query.secret||"");
      const session=await getJson("wz:pair:"+id);
      if(!session||session.secret!==secret)return json(res,404,{error:"Pairing session not found."});
      if(session.status!=="ready")return json(res,200,{status:"waiting"});
      await redis(["DEL","wz:pair:"+id]); await redis(["DEL","wz:code:"+session.code]);
      return json(res,200,{status:"ready",name:session.name,url:session.url});
    }
    return json(res,405,{error:"Method not allowed."});
  } catch(e) { return json(res,500,{error:e.message==="Pairing storage is not configured"?"Pairing service is not configured yet.":"Pairing service error."}); }
};