import { NextResponse } from 'next/server';

const OWNER = 'nicolelodeontv';
const REPO = 'fdattendancechecker';
const DATA_PATH = 'data/attendance.json';
const DATA_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'fdattendancechecker',
};

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured');
  return {
    ...GITHUB_HEADERS,
    Authorization: `Bearer ${token.trim()}`,
  };
}

async function githubGet() {
  const res = await fetch(DATA_API, {
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = String(payload?.message || '').trim();
    } catch {}
    console.error('GitHub datastore GET rejected', { status: res.status, detail });
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`GitHub data store GET failed: ${res.status}${suffix}`);
  }

  const json = await res.json();
  const sha = String(json.sha || '');
  const encoded = String(json.content || '').replace(/\s/g, '');

  if (!sha || !encoded) {
    throw new Error('GitHub data store returned an invalid file payload');
  }

  let data;
  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf8').trim();
    data = raw ? JSON.parse(raw) : { deadline: null, entries: [] };
  } catch {
    throw new Error('GitHub data store contains invalid JSON');
  }

  return { data, sha };
}

async function githubPut(data, message, sha) {
  if (!sha) throw new Error('GitHub data store file SHA is missing');

  const content = `${JSON.stringify(data, null, 2)}\n`;
  const encoded = Buffer.from(content, 'utf8').toString('base64');

  const res = await fetch(DATA_API, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = String(payload?.message || '').trim();
    } catch {}
    console.error('GitHub datastore update rejected', { status: res.status, detail, message });
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`GitHub data store update failed: ${res.status}${suffix}`);
  }

  return res.json();
}

async function discordUser(req) {
  const value = req.cookies.get('discord_session')?.value || '';
  const [payload, signature] = value.split('.');
  const secret = process.env.SESSION_SECRET;
  if (!secret || !payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(Buffer.from(signature, 'base64url')),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

function adminOk(req) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && req.headers.get('x-admin-password') === expected;
}

function normalizeEntry(entry) {
  return {
    id: String(entry.id),
    ign: String(entry.ign ?? '').trim(),
    attendance: entry.attendance === 'not_attending' ? 'not_attending' : 'attending',
    pilot: entry.pilot === 'no_pilot' ? 'no_pilot' : 'have_pilot',
    pilotName: String(entry.pilotName ?? '').trim(),
    hours: String(entry.hours ?? '').trim(),
    notes: String(entry.notes ?? '').trim(),
    submittedAt: entry.submittedAt,
    locked: entry.locked !== false,
    discordId: entry.discordId ? String(entry.discordId) : '',
    discordUsername: entry.discordUsername ? String(entry.discordUsername) : '',
  };
}

export async function GET(req) {
  try {
    const isAdmin = new URL(req.url).searchParams.get('admin') === '1';

    if (isAdmin && !adminOk(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let dataResult;
    try {
      dataResult = await githubGet();
    } catch (error) {
      if (isAdmin) {
        return NextResponse.json(
          {
            authenticated: true,
            entries: [],
            deadline: null,
            datastoreError: error.message,
          },
          { status: 200, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw error;
    }

    let { data, sha } = dataResult;
    if (!data.deadline) {
      data.deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await githubPut(data, 'Initialize 48-hour attendance deadline', sha);
    }

    if (!isAdmin) {
      const discord = await discordUser(req);
      const entry = discord?.discordId
        ? (data.entries || []).map(normalizeEntry).find((x) => x.discordId === String(discord.discordId))
        : null;
      return NextResponse.json(
        { deadline: data.deadline, entry: entry || null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { authenticated: true, deadline: data.deadline, entries: (data.entries || []).map(normalizeEntry) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const isAdmin = url.searchParams.get('admin') === '1';
    if (isAdmin && !adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    if (isAdmin && body?.action === 'set_deadline') {
      const deadline = String(body.deadline || '');
      if (!deadline || Number.isNaN(Date.parse(deadline))) {
        return NextResponse.json({ error: 'A valid response deadline is required.' }, { status: 400 });
      }
      const { data, sha } = await githubGet();
      data.deadline = new Date(deadline).toISOString();
      await githubPut(data, `Admin set FD attendance deadline: ${data.deadline}`, sha);
      return NextResponse.json({ ok: true, deadline: data.deadline });
    }

    if (isAdmin && body?.action === 'reset_locked') {
      const { data, sha } = await githubGet();
      const entries = data.entries || [];
      const lockedCount = entries.filter((entry) => entry.locked !== false).length;
      data.entries = entries.filter((entry) => entry.locked === false);
      await githubPut(data, `Admin reset locked FD attendance responses: ${lockedCount} removed`, sha);
      return NextResponse.json({ ok: true, removed: lockedCount });
    }

    if (isAdmin && body?.action === 'reset_one') {
      const id = String(body.id || '');
      if (!id) return NextResponse.json({ error: 'Response id is required.' }, { status: 400 });
      const { data, sha } = await githubGet();
      const entries = data.entries || [];
      const index = entries.findIndex((entry) => String(entry.id) === id);
      if (index === -1) return NextResponse.json({ error: 'Response not found.' }, { status: 404 });
      if (entries[index].locked === false) {
        return NextResponse.json({ error: 'This response is already unlocked.' }, { status: 400 });
      }
      const target = normalizeEntry(entries[index]);
      data.entries = entries.filter((entry) => String(entry.id) !== id);
      await githubPut(data, `Admin reset FD attendance response: ${target.ign || id}`, sha);
      return NextResponse.json({ ok: true, removed: 1, entry: target });
    }

    const discord = await discordUser(req);
    if (!isAdmin && !discord) {
      return NextResponse.json({ error: 'Please log in with Discord first.' }, { status: 401 });
    }

    const ign = String(body.ign ?? '').trim();
    if (!ign) return NextResponse.json({ error: 'IGN is required.' }, { status: 400 });
    if (!['attending', 'not_attending'].includes(body.attendance)) {
      return NextResponse.json({ error: 'Select attendance.' }, { status: 400 });
    }
    if (!['have_pilot', 'no_pilot'].includes(body.pilot)) {
      return NextResponse.json({ error: 'Select pilot.' }, { status: 400 });
    }
    if (body.pilot === 'have_pilot' && !String(body.pilotName ?? '').trim()) {
      return NextResponse.json({ error: 'Pilot Name is required when you have a pilot.' }, { status: 400 });
    }

    const { data, sha } = await githubGet();
    const now = new Date();
    const deadline = data.deadline || new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    if (!isAdmin && Date.now() > Date.parse(deadline)) {
      return NextResponse.json({ error: 'The response deadline has passed.' }, { status: 403 });
    }

    if (!isAdmin) {
      const existing = (data.entries || []).find(
        (entry) => String(entry.discordId || '') === String(discord.discordId),
      );
      if (existing) {
        return NextResponse.json(
          { error: 'A response already exists for this Discord account.', entry: normalizeEntry(existing) },
          { status: 409 },
        );
      }
    }

    const entry = normalizeEntry({
      ...body,
      id: crypto.randomUUID(),
      submittedAt: now.toISOString(),
      locked: !isAdmin,
      discordId: isAdmin ? '' : discord.discordId,
      discordUsername: isAdmin ? '' : discord.username,
    });

    data.deadline = deadline;
    data.entries = [...(data.entries || []), entry];
    await githubPut(data, `${isAdmin ? 'Admin add' : 'Add'} FD attendance response: ${ign}`, sha);
    return NextResponse.json({ entry, deadline }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { data, sha } = await githubGet();
    const index = (data.entries || []).findIndex((x) => String(x.id) === String(body.id));
    if (index === -1) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
    const current = data.entries[index];
    data.entries[index] = normalizeEntry({ ...current, ...body, locked: current.locked !== false });
    await githubPut(data, `Admin edit FD attendance: ${data.entries[index].ign}`, sha);
    return NextResponse.json({ entry: data.entries[index] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { data, sha } = await githubGet();
    data.entries = (data.entries || []).filter((x) => String(x.id) !== String(body.id));
    await githubPut(data, 'Admin delete FD attendance response', sha);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
