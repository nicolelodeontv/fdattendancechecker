import { NextResponse } from 'next/server';

async function verify(payload, signature) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !payload || !signature) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(Buffer.from(signature, 'base64url'));
  const ok = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(payload));
  if (!ok) return null;
  const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return user.exp > Date.now() ? user : null;
}

export async function GET(req) {
  try {
    const value = req.cookies.get('discord_session')?.value || '';
    const [payload, signature] = value.split('.');
    const user = await verify(payload, signature);
    return NextResponse.json({ authenticated: !!user, user: user || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('discord_session');
  return response;
}