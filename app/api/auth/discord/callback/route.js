import { NextResponse } from 'next/server';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function sign(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not configured.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString('base64url');
}

async function makeSession(user) {
  const payload = base64url(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  return `${payload}.${await sign(payload)}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = req.cookies.get('discord_oauth_state')?.value;
    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL('/?discord_error=invalid_state', url.origin));
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://fdattendancechecker.vercel.app/api/auth/discord/callback';
    if (!clientId || !clientSecret) {
      throw new Error('Discord OAuth environment variables are not configured.');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      let detail = '';
      try {
        const body = await tokenRes.json();
        detail = body?.error_description || body?.error || '';
      } catch {}
      throw new Error(detail ? `Discord token exchange failed: ${detail}` : `Discord token exchange failed (HTTP ${tokenRes.status}).`);
    }

    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('Discord returned no access token.');

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
    if (!userRes.ok) throw new Error(`Unable to read Discord profile (HTTP ${userRes.status}).`);
    const user = await userRes.json();

    const session = await makeSession({
      discordId: user.id,
      username: user.global_name || user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
    });

    const response = NextResponse.redirect(new URL('/', url.origin));
    response.cookies.set('discord_session', session, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    response.cookies.delete('discord_oauth_state');
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/?discord_error=${encodeURIComponent(error.message || 'Discord login failed.')}`, url.origin));
  }
}
