import { NextResponse } from 'next/server';

const OWNER = 'nicolelodeontv'; const REPO = 'fdattendancechecker'; const PATH = 'data/attendance.json';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
async function githubGet(){const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('GITHUB_TOKEN is not configured');const res=await fetch(API,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},cache:'no-store'});if(!res.ok)throw new Error(`GitHub GET failed: ${res.status}`);const json=await res.json();const raw=Buffer.from(json.content.replace(/\n/g,''),'base64').toString('utf8');return{data:JSON.parse(raw),sha:json.sha};}
async function githubPut(data,sha,message){const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('GITHUB_TOKEN is not configured');const content=Buffer.from(JSON.stringify(data,null,2)+'\n').toString('base64');const res=await fetch(API,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message,content,sha,branch:'main'})});if(!res.ok)throw new Error(`GitHub PUT failed: ${res.status}`);return res.json();}
async function discordUser(req){
  const value=req.cookies.get('discord_session')?.value || '';
  const [payload,signature]=value.split('.');
  const secret=process.env.SESSION_SECRET;
  if(!secret||!payload||!signature)return null;
  try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);const ok=await crypto.subtle.verify('HMAC',key,Uint8Array.from(Buffer.from(signature,'base64url')),new TextEncoder().encode(payload));if(!ok)return null;const user=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return user.exp>Date.now()?user:null;}catch{return null;}
}
function adminOk(req){const expected=process.env.ADMIN_PASSWORD;return!!expected&&req.headers.get('x-admin-password')===expected;}
function normalizeEntry(entry){return{id:String(entry.id),ign:String(entry.ign??'').trim(),attendance:entry.attendance==='not_attending'?'not_attending':'attending',pilot:entry.pilot==='no_pilot'?'no_pilot':'have_pilot',pilotName:String(entry.pilotName??'').trim(),hours:String(entry.hours??'').trim(),notes:String(entry.notes??'').trim(),submittedAt:entry.submittedAt,locked:entry.locked!==false,discordId:entry.discordId?String(entry.discordId):'',discordUsername:entry.discordUsername?String(entry.discordUsername):''};}
export async function GET(req){try{const isAdmin=new URL(req.url).searchParams.get('admin')==='1';if(isAdmin&&!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});let{data,sha}=await githubGet();if(!data.deadline){data.deadline=new Date(Date.now()+48*60*60*1000).toISOString();await githubPut(data,sha,'Initialize 48-hour attendance deadline');}
  if(!isAdmin){const discord=await discordUser(req);const entry=discord?.discordId?(data.entries||[]).map(normalizeEntry).find(x=>x.discordId===String(discord.discordId)):null;return NextResponse.json({deadline:data.deadline,entry:entry||null},{headers:{'Cache-Control':'no-store'}});}
  return NextResponse.json({deadline:data.deadline,entries:(data.entries||[]).map(normalizeEntry)},{headers:{'Cache-Control':'no-store'}});
}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function POST(req){try{const url=new URL(req.url);const isAdmin=url.searchParams.get('admin')==='1';if(isAdmin&&!adminOk(req))return NextResponse.json({error:'Unauthorized'});const body=await req.json();
  if(isAdmin&&body?.action==='reset_locked'){
    const{data,sha}=await githubGet();
    const entries=data.entries||[];
    const lockedCount=entries.filter((entry)=>entry.locked!==false).length;
    data.entries=entries.filter((entry)=>entry.locked===false);
    await githubPut(data,sha,`Admin reset locked FD attendance responses: ${lockedCount} removed`);
    return NextResponse.json({ok:true,removed:lockedCount});
  }
  const discord=await discordUser(req);if(!isAdmin&&!discord)return NextResponse.json({error:'Please log in with Discord first.'},{status:401});const ign=String(body.ign??'').trim();if(!ign)return NextResponse.json({error:'IGN is required.'},{status:400});if(!['attending','not_attending'].includes(body.attendance))return NextResponse.json({error:'Select attendance.'},{status:400});if(!['have_pilot','no_pilot'].includes(body.pilot))return NextResponse.json({error:'Select pilot status.'},{status:400});if(body.pilot==='have_pilot'&&!String(body.pilotName??'').trim())return NextResponse.json({error:'Pilot Name is required when you have a pilot.'},{status:400});const{data,sha}=await githubGet();const now=new Date();const deadline=data.deadline||new Date(now.getTime()+48*60*60*1000).toISOString();if(!isAdmin&&Date.now()>Date.parse(deadline))return NextResponse.json({error:'The response deadline has passed.'},{status:403});
  if(!isAdmin){const existing=(data.entries||[]).find(x=>String(x.discordId||'')===String(discord.discordId));if(existing)return NextResponse.json({error:'A response already exists for this Discord account.',entry:normalizeEntry(existing)},{status:409});}
  const entry=normalizeEntry({...body,id:crypto.randomUUID(),submittedAt:now.toISOString(),locked:!isAdmin,discordId:isAdmin?'':discord.discordId,discordUsername:isAdmin?'':discord.username});data.deadline=deadline;data.entries=[...(data.entries||[]),entry];await githubPut(data,sha,`${isAdmin?'Admin add':'Add'} FD attendance response: ${ign}`);return NextResponse.json({entry,deadline},{status:201});
}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function PATCH(req){if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const body=await req.json();const{data,sha}=await githubGet();const index=(data.entries||[]).findIndex(x=>String(x.id)===String(body.id));if(index===-1)return NextResponse.json({error:'Entry not found.'},{status:404});const current=data.entries[index];data.entries[index]=normalizeEntry({...current,...body,locked:current.locked!==false});await githubPut(data,sha,`Admin edit FD attendance: ${data.entries[index].ign}`);return NextResponse.json({entry:data.entries[index]});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
export async function DELETE(req){if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const body=await req.json();const{data,sha}=await githubGet();data.entries=(data.entries||[]).filter(x=>String(x.id)!==String(body.id));await githubPut(data,sha,'Admin delete FD attendance response');return NextResponse.json({ok:true});}catch(error){return NextResponse.json({error:error.message},{status:500});}}
