'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminResponseForm from './components/AdminResponseForm';

const EMPTY = { ign: '', attendance: '', pilot: '', pilotName: '', hours: '', notes: '' };
const ICONS = { yes: '✅', no: '❌', hourglass: '⏳', lock: '🔒' };

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0
    ? `${String(d).padStart(2, '0')}:${String(h).padStart(2, '2')}:${String(m).padStart(2, '2')}:${String(s).padStart(2, '2')}`
    : `${String(h).padStart(2, '2')}:${String(m).padStart(2, '2')}:${String(s).padStart(2, '2')}`;
}

function useManilaClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'medium',
  }).format(now);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(entries) {
  const headers = ['IGN', 'Attendance', 'Pilot', 'Pilot Name', 'Hours', 'Notes', 'Submitted At (PH)', 'Locked'];
  const rows = entries.map((x) => [
    x.ign,
    x.attendance === 'attending' ? 'Attending' : 'Not Attending',
    x.pilot === 'have_pilot' ? 'Have Pilot' : 'No Pilot',
    x.pilotName, x.hours, x.notes,
    x.submittedAt ? new Date(x.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '',
    x.locked ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fd-attendance-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function Home() {
  const clock = useManilaClock();
  const [form, setForm] = useState(EMPTY);
  const [lockedEntry, setLockedEntry] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [entries, setEntries] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [discordUser, setDiscordUser] = useState(null);
  const [discordLoading, setDiscordLoading] = useState(true);
  const [discordError, setDiscordError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [submitPopup, setSubmitPopup] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load tracker.');
      setDeadline(data.deadline);
      if (data.entry) {
        setLockedEntry(data.entry);
        setForm({ ign: data.entry.ign, attendance: data.entry.attendance, pilot: data.entry.pilot, pilotName: data.entry.pilotName, hours: data.entry.hours, notes: data.entry.notes });
        localStorage.setItem('fd_attendance_entry', JSON.stringify(data.entry));
      } else {
        localStorage.removeItem('fd_attendance_entry');
        setLockedEntry(null);
        setForm(EMPTY);
      }
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };

  async function loadAdminEntries(password = adminPassword) {
    if (!password) return;
    const res = await fetch('/api/attendance?admin=1', {
      headers: { 'x-admin-password': password },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to refresh responses.');
    setEntries(data.entries || []);
    if (data.deadline) setDeadline(data.deadline);
    return data;
  }

  useEffect(() => {
    load();
    fetch('/api/auth/discord/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => { if (data.authenticated) setDiscordUser(data.user); })
      .catch(() => {})
      .finally(() => setDiscordLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('discord_error');
    if (error) {
      setDiscordError(error === 'access_denied' ? 'Discord login was cancelled.' : error.replace(/^error_/, '').replace(/_/g, ' '));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => (deadline ? Date.parse(deadline) - now : null), [deadline, now]);
  const closed = remaining !== null && remaining <= 0;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e) {
    e.preventDefault(); setMessage('');
    if (!discordUser) { setMessage('Please log in with Discord first.'); return; }
    if (!form.ign.trim() || !form.attendance || !form.pilot || (form.pilot === 'have_pilot' && !form.pilotName.trim())) {
      setMessage('Please complete the required fields.'); return;
    }
    try {
      const res = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      localStorage.setItem('fd_attendance_entry', JSON.stringify(data.entry));
      setLockedEntry(data.entry); setDeadline(data.deadline); setMessage('Response submitted and locked.');
      setSubmitPopup({ ign: data.entry?.ign || form.ign.trim() });
    } catch (error) { setMessage(error.message); }
  }

  async function logoutDiscord() {
    await fetch('/api/auth/discord/me', { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem('fd_attendance_entry');
    setDiscordUser(null); setLockedEntry(null); setForm(EMPTY); setMessage('Logged out of Discord.');
  }

  async function adminLogin(e) {
    e.preventDefault(); setAdminError('');
    try {
      const res = await fetch('/api/attendance?admin=1', { headers: { 'x-admin-password': adminPassword }, cache: 'no-store' });
      const data = await res.json();
      if (res.status === 401) throw new Error('Incorrect admin password.');
      if (!res.ok) throw new Error(data.error || 'Admin login failed.');
      setEntries(data.entries || []); setDeadline(data.deadline); setAdminAuthed(true); setAdminOpen(true); sessionStorage.setItem('fd_admin', adminPassword);
    } catch (error) { setAdminError(error.message); }
  }

  useEffect(() => {
    const pw = sessionStorage.getItem('fd_admin');
    if (!pw) return;
    setAdminPassword(pw); setAdminAuthed(true); setAdminOpen(true);
    loadAdminEntries(pw).catch(() => {});
  }, []);

  async function saveEntry(entry) {
    const res = await fetch('/api/attendance', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify(entry) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    setEntries((old) => old.map((x) => (x.id === entry.id ? data.entry : x)));
  }

  function deleteEntry(id) {
    const target = entries.find((entry) => entry.id === id);
    if (!target) return;
    setDeleteMessage(''); setDeleteTarget(target);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true); setDeleteMessage('');
    try {
      const res = await fetch('/api/attendance', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify({ id: deleteTarget.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      setEntries((old) => old.filter((x) => x.id !== deleteTarget.id)); setDeleteTarget(null); setDeleteMessage('Response deleted successfully.');
    } catch (error) { setDeleteMessage(error.message); }
    finally { setDeleteBusy(false); }
  }

  function cancelDelete() { if (deleteBusy) return; setDeleteTarget(null); setDeleteMessage(''); }

  function logoutAdmin() {
    sessionStorage.removeItem('fd_admin'); setAdminPassword(''); setAdminAuthed(false); setAdminOpen(false); setEntries([]); setAdminError(''); setMessage(''); setDeleteTarget(null); setDeleteMessage('');
  }

  const adminMode = adminOpen || adminAuthed;

  return (
    <div className="site-wrapper">
      <div className="shell">
        <header className="site-header">
          <div className="header-banner"><h1>CHAOS FD ATTENDANCE CHECKER</h1><span>{adminMode ? 'ADMIN / CONTROL' : 'FD / ATTENDANCE'}</span></div>
          <div className="server-time-bar"><div className="server-left"><span className="live-dot" /><span className="server-label">Philippine Server Time</span><span className="server-value">{clock}</span></div><span className="server-zone">Asia/Manila · UTC+8</span></div>
        </header>

        <main className="content-card">
          {!adminMode && (
            <>
              <div className="card-heading"><div className="eyebrow">RESPONSE FORM</div><h2>Final Day Attendance</h2><p>Complete your attendance, pilot, and availability details. Your response is tied to your Discord account and locked after submission.</p></div>
              <div className="deadline"><div className="deadline-copy">{ICONS.hourglass} <b>Response deadline:</b> 48 hours from the start of this response period.</div><div className="deadline-time">{closed ? 'DEADLINE PASSED' : formatCountdown(remaining ?? 0)}</div></div>

              {!discordUser && !lockedEntry && (
                <div className="form">
                  <div className="card-heading" style={{ padding: '0 0 8px' }}><div className="eyebrow">RESPONDER LOGIN</div><h2>Login with Discord</h2><p>Sign in with Discord before submitting your Final Day Attendance. Your response will be securely linked to your Discord account.</p></div>
                  <div className="submit-row"><a className="submit" href="/api/auth/discord/login">LOGIN WITH DISCORD</a></div>
                  {discordError && <div className="notice danger" style={{ marginTop: 10 }}>{discordError}</div>}
                </div>
              )}

              {discordUser && !lockedEntry && (
                <div className="form">
                  <div className="notice good"><b>DISCORD:</b> {discordUser.username || 'Authenticated'} <button type="button" className="small-btn" style={{ float: 'right', marginTop: -4 }} onClick={logoutDiscord}>LOGOUT</button></div>
                </div>
              )}

              {discordUser && !lockedEntry ? (
                <form className="form" onSubmit={submit} style={{ position: 'relative', zIndex: 50, pointerEvents: 'auto' }}>
                  <div className="field" style={{ position: 'relative', zIndex: 55 }}><label style={{ pointerEvents: 'none' }}>IGN <span className="required">*</span></label><input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }} /></div>
                  <div className="grid-2"><ChoiceGroup title="Attendance" name="attendance" value={form.attendance} disabled={false} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} /><ChoiceGroup title="Pilot" name="pilot" value={form.pilot} disabled={false} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} /></div>
                  <div className="grid-2"><div className="field" style={{ position: 'relative', zIndex: 55 }}><label style={{ pointerEvents: 'none' }}>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label><input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" disabled={form.pilot !== 'have_pilot'} style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }} /></div><div className="field" style={{ position: 'relative', zIndex: 55 }}><label style={{ pointerEvents: 'none' }}>Hours</label><input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }} /></div></div>
                  <div className="field" style={{ position: 'relative', zIndex: 55 }}><label style={{ pointerEvents: 'none' }}>Notes <span>(optional)</span></label><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }} /></div>
                  <div className="submit-row"><button className="submit" type="submit" disabled={closed}>SUBMIT RESPONSE</button></div>
                  {message && <div className={`notice ${message.includes('locked') ? 'good' : 'danger'}`}>{message}</div>}
                </form>
              ) : lockedEntry ? (
                <div className="form">
                  <div className="notice good"><span className="lock">{ICONS.lock}</span> Your response is locked after submission. This lock is tied to your Discord account.</div>
                  <div className="entry" style={{ marginTop: 10 }}><div className="entry-top"><div className="entry-ign">{lockedEntry.ign}</div><span className="badge info">SUBMITTED {new Date(lockedEntry.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span></div><div className="badge-row"><span className={`badge ${lockedEntry.attendance === 'attending' ? 'good' : 'danger'}`}>{lockedEntry.attendance === 'attending' ? ICONS.yes : ICONS.no} {lockedEntry.attendance === 'attending' ? 'ATTENDING' : 'NOT ATTENDING'}</span><span className="badge info">{lockedEntry.pilot === 'have_pilot' ? ICONS.yes : ICONS.no} {lockedEntry.pilot === 'have_pilot' ? `PILOT: ${lockedEntry.pilotName}` : 'NO PILOT'}</span><span className="badge">HOURS: {lockedEntry.hours || '—'}</span></div>{lockedEntry.notes && <div className="notice" style={{ marginTop: 9 }}>{lockedEntry.notes}</div>}</div>
                </div>
              ) : null}
            </>
          )}

          <section className="admin">
            <div className="admin-head"><div><h3>ADMIN CONTROLS</h3>{adminAuthed && <div className="admin-sub">{entries.length} RESPONSE{entries.length === 1 ? '' : 'S'}</div>}</div><div className="admin-head-actions">{adminOpen && adminAuthed && <><button className="small-btn export-btn" type="button" disabled={!entries.length} onClick={() => exportCsv(entries)}>EXPORT</button><button className="small-btn danger-btn" type="button" onClick={logoutAdmin}>LOGOUT</button></>}<button className="small-btn" type="button" onClick={() => setAdminOpen((value) => !value)}>{adminOpen ? 'HIDE' : 'OPEN'}</button></div></div>
            {adminOpen && !adminAuthed && <form className="admin-login" onSubmit={adminLogin}><div className="password-field"><input type={showAdminPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" /><button className="password-toggle" type="button" aria-label={showAdminPassword ? 'Hide password' : 'Show password'} onClick={() => setShowAdminPassword((value) => !value)}>{showAdminPassword ? '◉' : '◌'}</button></div><button className="small-btn" type="submit">UNLOCK</button></form>}
            {adminError && adminOpen && <div className="notice danger">{adminError}</div>}
            {deleteMessage && <div className="notice good">{deleteMessage}</div>}
            {adminOpen && adminAuthed && <div style={{ marginTop: 10, position: 'relative', zIndex: 20 }}><AdminResponseForm deadline={deadline} adminPassword={adminPassword} onCreated={(entry, nextDeadline) => { setEntries((old) => [...old, entry]); if (nextDeadline) setDeadline(nextDeadline); }} onResetLocked={() => loadAdminEntries().catch((error) => setDeleteMessage(error.message))} /><div className="notice good" style={{ marginTop: 10 }}>Admin-created responses remain <b>UNLOCKED</b>. Respondent submissions remain <b>🔒 LOCKED</b>.</div>{entries.length === 0 ? <div className="notice" style={{ marginTop: 10 }}>No submitted responses yet. Use the admin response form above to add one.</div> : entries.map((entry) => <AdminEntry key={entry.id} entry={entry} onSave={saveEntry} onDelete={deleteEntry} />)}</div>}
          </section>
        </main>

        <footer className="site-footer"><p>FD Attendance Checker · Philippine Time · Responses lock after submit</p></footer>
      </div>

      {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelDelete(); }}><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"><div className="eyebrow">ADMIN ACTION</div><h2 id="delete-modal-title">DELETE RESPONSE?</h2><p>Are you sure you want to delete <b>{deleteTarget.ign || 'this response'}</b>? This action cannot be undone.</p>{deleteMessage && <div className="notice danger">{deleteMessage}</div>}<div className="confirm-actions"><button className="small-btn" type="button" disabled={deleteBusy} onClick={cancelDelete}>CANCEL</button><button className="small-btn danger-btn modal-delete-btn" type="button" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'DELETING…' : 'DELETE'}</button></div></div></div>}
      {submitPopup && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSubmitPopup(null); }}><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title"><div className="eyebrow">RESPONSE SUBMITTED</div><h2 id="submit-modal-title">SUCCESS</h2><div className="notice good">✅ <b>{submitPopup.ign}</b> submitted successfully.</div><p>Your Final Day Attendance response has been recorded and is now <b>🔒 LOCKED</b> to your Discord account.</p><div className="confirm-actions"><button className="small-btn" type="button" onClick={() => setSubmitPopup(null)}>CLOSE</button></div></div></div>}
    </div>
  );
}

function ChoiceGroup({ title, name, value, disabled, options, onChange }) {
  return <div className="field" style={{ position: 'relative', zIndex: 55 }}><label style={{ pointerEvents: 'none' }}>{title} <span className="required">*</span></label><div className="choices" style={{ position: 'relative', zIndex: 56 }}>{options.map(([valueOption, text], index) => <div className="choice" key={valueOption}><input id={`${name}-${index}`} type="radio" name={name} checked={value === valueOption} onChange={() => onChange(valueOption)} disabled={disabled} /><label htmlFor={`${name}-${index}`} style={{ pointerEvents: 'auto' }}>{text}</label></div>)}</div></div>;
}

function AdminEntry({ entry, onSave, onDelete }) {
  const [draft, setDraft] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => setDraft(entry), [entry]);
  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => { setSaving(true); setStatus(''); try { await onSave(draft); setStatus('Saved'); } catch (error) { setStatus(error.message); } finally { setSaving(false); } };
  return <div className="entry"><div className="entry-top"><div className="entry-ign">{entry.ign || 'Unnamed response'}</div><div className="badge-row"><span className={`badge ${entry.locked ? 'info' : 'good'}`}>{entry.locked ? '🔒 LOCKED' : 'UNLOCKED'}</span><span className="badge info">SUBMITTED {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</span></div></div><div className="entry-fields"><div className="field"><label>IGN</label><input value={draft.ign} onChange={(e) => patch('ign', e.target.value)} placeholder="IGN" disabled={saving} /></div><div className="field"><label>Attendance</label><select value={draft.attendance} onChange={(e) => patch('attendance', e.target.value)} disabled={saving}><option value="attending">✅ Attending</option><option value="not_attending">❌ Not Attending</option></select></div><div className="field"><label>Pilot</label><select value={draft.pilot} onChange={(e) => patch('pilot', e.target.value)} disabled={saving}><option value="have_pilot">✅ Have Pilot</option><option value="no_pilot">❌ No Pilot</option></select></div><div className="field"><label>Pilot Name</label><input value={draft.pilotName} onChange={(e) => patch('pilotName', e.target.value)} placeholder="Pilot name" disabled={saving} /></div><div className="field"><label>Hours</label><input value={draft.hours} onChange={(e) => patch('hours', e.target.value)} placeholder="Hours" disabled={saving} /></div><div className="field admin-notes-field"><label>Notes</label><textarea value={draft.notes} onChange={(e) => patch('notes', e.target.value)} placeholder="Notes" disabled={saving} /></div></div><div className="admin-actions"><button className="small-btn" type="button" disabled={saving} onClick={save}>{saving ? 'SAVING…' : 'SAVE'}</button><button className="small-btn danger-btn" type="button" disabled={saving} onClick={() => onDelete(entry.id)}>DELETE</button>{status && <span className={`badge ${status === 'Saved' ? 'good' : 'danger'}`}>{status}</span>}</div></div>;
}
