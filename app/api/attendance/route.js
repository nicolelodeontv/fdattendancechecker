import { NextResponse } from 'next/server';

const OWNER = 'nicolelodeontv';
const REPO = 'fdattendancechecker';
const DATA_PATH = 'data/attendance.json';
const DATA_BRANCH = 'attendance-data';
const DATA_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
const GITHUB_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'fdattendancechecker' };
const rateLimit = globalThis.__fdAttendanceRateLimit || new Map();
globalThis.__fdAttendanceRateLimit = rateLimit;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
function getClientIp(req) { return (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim() || 'unknown'; }
function rateLimited(req) { const ip=getClientIp(req), now=Date.now(), current=rateLimit.get(ip); if(!current||now-current.startedAt>=RATE_LIMIT_WINDOW_MS){rateLimit.set(ip,{startedAt:now,count:1});return false;} current.count+=1; return current.count>RATE_LIMIT_MAX; }
function authHeaders() { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error('GITHUB_TOKEN is not configured'); return {...GITHUB_HEADERS,Authorization:`Bearer ${token.trim()}`}; }
async function githubGet() { const res=await fetch(`${DATA_API}?ref=${encodeURIComponent(DATA_BRANCH)}`,{headers:authHeaders(),cache:'no-store'}); if(!res.ok){let detail='';try{detail=String((await res.json())?.message||'').trim()}catch{} console.error('GitHub datastore GET rejected',{status:res.status,detail});throw new Error(`GitHub data store GET failed: ${res.status}${detail?`: ${detail}`:''}`);} const json=await res.json(); const sha=String(json.sha||''); const encoded=String(json.content||'').replace(/\s/g,''); if(!sha||!encoded)throw new Error('GitHub data store returned an invalid file payload'); let data; try{data=JSON.parse(Buffer.from(encoded,'base64').toString('utf8').trim())}catch{throw new Error('GitHub data store contains invalid JSON')} return {data,sha}; }
async function githubPut(data,message,sha){if(!sha)throw new Error('GitHub data store file SHA is missing');const encoded=Buffer.from(`${JSON.stringify(data,null,2)}\n`,'utf8').toString('base64');const res=await fetch(DATA_API,{method:'PUT',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({message,content:encoded,sha,branch:DATA_BRANCH}),cache:'no-store'});if(!res.ok){let detail='';try{detail=String((await res.json())?.message||'').trim()}catch{} console.error('GitHub datastore update rejected',{status:res.status,detail,message});throw new Error(`GitHub data store update failed: ${res.status}${detail?`: ${detail}`:''}`);}return res.json();}
async function discordUser(req){const value=req.cookies.get('discord_session')?.value||'';const [payload,signature]=value.split('.');const secret=process.env.SESSION_SECRET;if(!secret||!payload||!signature)return null;try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);const ok=await crypto.subtle.verify('HMAC',key,Uint8Array.from(Buffer.from(signature,'base64url')),new TextEncoder().encode(payload));if(!ok)return null;const user=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return user.exp>Date.now()?user:null}catch{return null;}}
function adminOk(req){const expected=process.env.ADMIN_PASSWORD;return !!expected&&req.headers.get('x-admin-password')===expected;}
function normalizeHours(value){const raw=String(value??'').trim();if(!raw)return '';const numeric=Number.parseFloat(raw.replace(/\s*(?:hours?|hrs?)\s*$/i,'').trim());return Number.isFinite(numeric)?String(numeric):raw.replace(/\s*(?:hours?|hrs?)\s*$/i,'').trim();}
function normalizeEntry(entry){
  const rawPilot=String(entry.pilot??'').trim().toLowerCase();
  const pilot=rawPilot==='no_pilot'?'no_pilot':rawPilot==='have_pilot'?'have_pilot':'';
  const rawAttendance=String(entry.attendance??'').trim().toLowerCase();
  const attendance=rawAttendance==='not_attending'?'not_attending':rawAttendance==='attending'?'attending':'';
  return {
    id:String(entry.id),
    ign:String(entry.ign??'').trim(),
    attendance,
    pilot,
    pilotName:pilot==='have_pilot'?String(entry.pilotName??'').trim():'',
    hours:normalizeHours(entry.hours),
    notes:String(entry.notes??'').trim(),
    submittedAt:entry.submittedAt,
    locked:entry.locked!==false,
    discordId:entry.discordId?String(entry.discordId):'',
    discordUsername:entry.discordUsername?String(entry.discordUsername):''
  };
}
function validateEntry(entry){
  if(!entry.ign)return 'IGN is required.';
  if(!['attending','not_attending'].includes(entry.attendance))return 'Select attendance.';
  if(!['have_pilot','no_pilot'].includes(entry.pilot))return 'Select pilot.';
  if(entry.pilot==='have_pilot'&&!entry.pilotName)return 'Pilot Name is required when you have a pilot.';
  return null;
}
function buildAttendingRankings(entries){return(entries||[]).map(normalizeEntry).filter(entry=>entry.attendance==='attending').sort((a,b)=>{const hoursA=Number.parseFloat(a.hours)||0,hoursB=Number.parseFloat(b.hours)||0;if(hoursB!==hoursA)return hoursB-hoursA;const timeA=Date.parse(a.submittedAt||'')||0,timeB=Date.parse(b.submittedAt||'')||0;return timeA-timeB;}).map((entry,index)=>({rank:index+1,ign:entry.ign,hours:entry.hours}));}
export async function GET(req){try{const isAdmin=new URL(req.url).searchParams.get('admin')==='1';if(isAdmin&&!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});let dataResult;try{dataResult=await githubGet()}catch(error){if(isAdmin)return NextResponse.json({authenticated:true,entries:[],attendingRankings:[],deadline:null,datastoreError:error.message},{status:200,headers:{'Cache-Control':'no-store'}});throw error;}let{data,sha}=dataResult;if(!data.deadline){data.deadline=new Date(Date.now()+48*60*60*1000).toISOString();await githubPut(data,'Initialize 48-hour attendance deadline',sha);}if(!isAdmin){const discord=await discordUser(req);const entry=discord?.discordId?(data.entries||[]).map(normalizeEntry).find(x=>x.discordId===String(discord.discordId)):null;return NextResponse.json({deadline:data.deadline,entry:entry||null,attendingRankings:buildAttendingRankings(data.entries)},{headers:{'Cache-Control':'no-store'}});}return NextResponse.json({authenticated:true,deadline:data.deadline,entries:(data.entries||[]).map(normalizeEntry),attendingRankings:buildAttendingRankings(data.entries)},{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function POST(req){try{const url=new URL(req.url),isAdmin=url.searchParams.get('admin')==='1';if(isAdmin&&!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});if(!isAdmin&&rateLimited(req))return NextResponse.json({error:'Too many submission attempts. Please wait a minute and try again.'},{status:429,headers:{'Retry-After':'60'}});const body=await req.json();if(!isAdmin&&String(body.website||'').trim())return NextResponse.json({error:'Submission rejected.'},{status:400});
if(isAdmin&&body?.action==='set_deadline'){const deadline=String(body.deadline||'');if(!deadline||Number.isNaN(Date.parse(deadline)))return NextResponse.json({error:'A valid response deadline is required.'},{status:400});const{data,sha}=await githubGet();data.deadline=new Date(deadline).toISOString();await githubPut(data,`Admin set FD attendance deadline: ${data.deadline}`,sha);return NextResponse.json({ok:true,deadline:data.deadline});}
if(isAdmin&&body?.action==='reset_locked'){const{data,sha}=await githubGet();const entries=data.entries||[];const lockedCount=entries.filter(entry=>entry.locked!==false).length;data.entries=entries.filter(entry=>entry.locked===false);await githubPut(data,`Admin reset locked FD attendance responses: ${lockedCount} removed`,sha);return NextResponse.json({ok:true,removed:lockedCount,attendingRankings:buildAttendingRankings(data.entries)});}
if(isAdmin&&body?.action==='reset_one'){const id=String(body.id||'');if(!id)return NextResponse.json({error:'Response id is required.'},{status:400});const{data,sha}=await githubGet();const entries=data.entries||[];const target=entries.find(entry=>String(entry.id)===id);if(!target)return NextResponse.json({error:'Response not found.'},{status:404});const normalized=normalizeEntry(target);data.entries=entries.filter(entry=>String(entry.id)!==id);await githubPut(data,`Admin reset FD attendance response: ${normalized.ign||id}`,sha);return NextResponse.json({ok:true,removed:1,entry:normalized,attendingRankings:buildAttendingRankings(data.entries)});}
const discord=await discordUser(req);if(!isAdmin&&!discord)return NextResponse.json({error:'Please log in with Discord first.'},{status:401});
const normalized=normalizeEntry(body);
const validationError=validateEntry(normalized);
if(validationError)return NextResponse.json({error:validationError},{status:400});
const{data,sha}=await githubGet();const now=new Date();const deadline=data.deadline||new Date(now.getTime()+48*60*60*1000).toISOString();if(!isAdmin&&Date.now()>Date.parse(deadline))return NextResponse.json({error:'The response deadline has passed.'},{status:403});if(!isAdmin){const existing=(data.entries||[]).find(entry=>String(entry.discordId||'')===String(discord.discordId));if(existing)return NextResponse.json({error:'A response already exists for this Discord account.',entry:normalizeEntry(existing)},{status:409});}const entry=normalizeEntry({...body,id:crypto.randomUUID(),submittedAt:now.toISOString(),locked:!isAdmin,discordId:isAdmin?'':discord.discordId,discordUsername:isAdmin?'':discord.username});data.deadline=deadline;data.entries=[...(data.entries||[]),entry];await githubPut(data,`${isAdmin?'Admin add':'Add'} FD attendance response: ${entry.ign}`,sha);const attendingRankings=buildAttendingRankings(data.entries);return NextResponse.json({entry,deadline,attendingRankings,loggedOut:false},{status:201});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function PATCH(req){if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const body=await req.json();const{data,sha}=await githubGet();const index=(data.entries||[]).findIndex(x=>String(x.id)===String(body.id));if(index===-1)return NextResponse.json({error:'Entry not found.'},{status:404});const current=data.entries[index];const merged=normalizeEntry({...current,...body,locked:current.locked!==false});const validationError=validateEntry(merged);if(validationError)return NextResponse.json({error:validationError},{status:400});data.entries[index]=merged;await githubPut(data,`Admin edit FD attendance: ${data.entries[index].ign}`,sha);return NextResponse.json({entry:data.entries[index],attendingRankings:buildAttendingRankings(data.entries)});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function DELETE(req){if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const body=await req.json();const{data,sha}=await githubGet();const before=data.entries||[];data.entries=before.filter(x=>String(x.id)!==String(body.id));if(data.entries.length===before.length)return NextResponse.json({error:'Entry not found.'},{status:404});await githubPut(data,'Admin delete FD attendance response',sha);return NextResponse.json({ok:true,attendingRankings:buildAttendingRankings(data.entries)});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
