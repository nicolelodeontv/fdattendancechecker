import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'DISCORD_CLIENT_ID is not configured.' }, { status: 500 });

  const state = crypto.randomUUID();
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://fdattendancechecker.vercel.app/api/auth/discord/callback';
  const auth = new URL('https://discord.com/oauth2/authorize');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', 'identify');
  auth.searchParams.set('state', state);

  const response = NextResponse.redirect(auth);
  response.headers.set('Cache-Control', 'no-store, private, max-age=0');
  response.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
