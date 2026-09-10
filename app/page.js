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

function useLocalClock() {
  const [now, setNow] = useState(Date.now());
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local');
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const formatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium', timeZone }), [timeZone]);
  const zoneFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'shortOffset', hour: '2-digit', minute: '2-digit' }), [timeZone]);
  const offset = zoneFormatter.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value || 'Local time';
  return { text: formatter.format(now), timeZone, offset };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(entries) {
  const headers = ['IGN', 'Discord Account', 'Discord ID', 'Attendance', 'Pilot', 'Pilot Name', 'Hours', 'Notes', 'Submitted At (PH)', 'Locked'];
  const rows = entries.map((x) => [x.ign, x.discordUsername || 'Admin-created', x.discordId || '', x.attendance === 'attending' ? 'Attending' : 'Not Attending', x.pilot === 'have_pilot' ? 'Have Pilot' : 'No Pilot', x.pilotName, x.hours, x.notes, x.submittedAt ? new Date(x.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '', x.locked ? 'Yes' : 'No']);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fd-attendance-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function Home() {
  const clock = useLocalClock();
  const [form, setForm] = useState(EMPTY);
  const [lockedEntry, setLockedEntry] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [entries, setEntries] = useState([]);
  const [attendingRankings, setAttendingRankings] = useState([]);
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
      setAttendingRankings(data.attendingRankings || []);
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
    const res = await fetch('/api/attendance?admin=1', { headers: { 'x-admin-password': password }, cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to refresh responses.');
    setEntries(data.entries || []);
    setAttendingRankings(data.attendingRankings || []);
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

      const submittedEntry = data.entry;
      setLockedEntry(submittedEntry);
      setForm({ ign: submittedEntry.ign, attendance: submittedEntry.attendance, pilot: submittedEntry.pilot, pilotName: submittedEntry.pilotName, hours: submittedEntry.hours, notes: submittedEntry.notes });
      localStorage.setItem('fd_attendance_entry', JSON.stringify(submittedEntry));
      setAttendingRankings(data.attendingRankings || []);
      setDeadline(data.deadline);
      setMessage('Response submitted successfully. You remain logged in to Discord.');
      setSubmitPopup({ ign: submittedEntry.ign });
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
      setEntries(data.entries || []); setAttendingRankings(data.attendingRankings || []); setDeadline(data.deadline); setAdminAuthed(true); setAdminOpen(true); sessionStorage.setItem('fd_admin', adminPassword);
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
    setAttendingRankings(data.attendingRankings || []);
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
      setEntries((old) => old.filter((x) => x.id !== deleteTarget.id));
      setAttendingRankings(data.attendingRankings || []);
      setDeleteTarget(null); setDeleteMessage('Response deleted successfully.');
    } catch (error) { setDeleteMessage(error.message); }
    finally { setDeleteBusy(false); }
  }

  function cancelDelete() { if (deleteBusy) return; setDeleteTarget(null); setDeleteMessage(''); }

  function logoutAdmin() {
    sessionStorage.removeItem('fd_admin'); setAdminPassword(''); setAdminAuthed(false); setAdminOpen(false); setEntries([]); setAdminError(''); setMessage(''); setDeleteTarget(null); setDeleteMessage('');
  }

  const adminMode = adminAuthed;

  return (
    <div className="site-wrapper">
      <div className="shell">
        <header className="site-header">
          <div className="header-banner">
            <h1>CHAOS FD ATTENDANCE CHECKER</h1>
            <div className="header-actions">
              <span>{adminMode ? 'ADMIN / CONTROL' : 'FD / ATTENDANCE'}</span>
              {!adminAuthed ? <button className="header-admin-btn" type="button" onClick={() => { setAdminOpen(true); setAdminError(''); }}>ADMIN ACCESS</button> : <button className="header-admin-btn" type="button" onClick={logoutAdmin}>LOGOUT ADMIN</button>}
            </div>
          </div>
          {adminOpen && !adminAuthed && (
            <form className="header-admin-login" onSubmit={adminLogin}>
              <div className="password-field">
                <input type={showAdminPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" autoComplete="current-password" />
                <button className="password-toggle" type="button" aria-label={showAdminPassword ? 'Hide password' : 'Show password'} onClick={() => setShowAdminPassword((show) => !show)}>{showAdminPassword ? 'H' : 'S'}</button>
              </div>
              <button className="small-btn" type="submit">UNLOCK</button>
            </form>
          )}
          {adminError && adminOpen && !adminAuthed && <div className="notice danger admin-header-error">{adminError}</div>}
          <div className="server-time-bar"><div className="server-left"><span className="live-dot" /><span className="server-label">Local Time</span><span className="server-value">{clock.text}</span></div><span className="server-zone">{clock.timeZone} · {clock.offset}</span></div>
        </header>

        <main className="content-card">
          {!adminMode && (
            <>
              <div className="card-heading"><div className="eyebrow">RESPONSE FORM</div><h2>Final Day Attendance</h2><p>Complete your attendance, pilot, and availability details. Your response is tied to your Discord account and locked after submission.</p></div>
              <div className="deadline"><div className="deadline-copy">{ICONS.hourglass} <b>Response deadline:</b> 48 hours from the start of this response period.</div><div className="deadline-time">{closed ? 'DEADLINE PASSED' : formatCountdown(remaining ?? 0)}</div></div>

              <div className="responder-layout">
                <div className="responder-main">
                  {!discordUser && !lockedEntry && (
                    <div className="form">
                      <div className="card-heading" style={{ padding: '0 0 8px' }}><div className="eyebrow">RESPONDER LOGIN</div><h2>Login with Discord</h2><p>Sign in with Discord before submitting your Final Day Attendance. Your response will be securely linked to your Discord account.</p></div>
                      <div className="submit-row"><a className="submit" href="/api/auth/discord/login">LOGIN WITH DISCORD</a></div>
                      {discordError && <div className="notice danger" style={{ marginTop: 10 }}>{discordError}</div>}
                    </div>
                  )}

                  {discordUser && !lockedEntry && (
                    <form className="form" onSubmit={submit}>
                      <div className="notice good"><b>DISCORD:</b> {discordUser.username || 'Authenticated'}</div>
                      <div className="field"><label>IGN <span className="required">*</span></label><input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" /></div>
                      <div className="grid-2"><ChoiceGroup title="Attendance" name="attendance" value={form.attendance} disabled={false} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} /><ChoiceGroup title="Pilot" name="pilot" value={form.pilot} disabled={false} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} /></div>
                      <div className="grid-2"><div className="field"><label>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label><input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" /></div><div className="field"><label>Hours</label><input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" /></div></div>
                      <div className="field"><label>Notes <span>(optional)</span></label><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" /></div>
                      <div className="submit-row"><button className="submit" type="submit" disabled={closed}>SUBMIT RESPONSE</button></div>
                      {message && <div className={`notice ${message.includes('submitted successfully') ? 'good' : 'danger'}`}>{message}</div>}
                      <div className="submit-row response-logout-row"><button type="button" className="small-btn" onClick={logoutDiscord}>DISCORD LOGOUT</button></div>
                    </form>
                  )}

                  {lockedEntry && (
                    <div className="form">
                      <div className="notice good"><span className="lock">{ICONS.lock}</span> Your response is locked after submission. This lock is tied to your Discord account.</div>
                      <div className="entry" style={{ marginTop: 10 }}><div className="entry-top"><div className="entry-ign">{lockedEntry.ign}</div><span className="badge info">SUBMITTED {new Date(lockedEntry.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span></div><div className="badge-row"><span className={`badge ${lockedEntry.attendance === 'attending' ? 'good' : 'danger'}`}>{lockedEntry.attendance === 'attending' ? ICONS.yes : ICONS.no} {lockedEntry.attendance === 'attending' ? 'ATTENDING' : 'NOT ATTENDING'}</span><span className="badge info">{lockedEntry.pilot === 'have_pilot' ? ICONS.yes : ICONS.no} {lockedEntry.pilot === 'have_pilot' ? `PILOT: ${lockedEntry.pilotName}` : 'NO PILOT'}</span><span className="badge info">{lockedEntry.hours ? `${lockedEntry.hours} HRS` : 'HOURS: —'}</span></div>{lockedEntry.notes && <div className="entry-notes">{lockedEntry.notes}</div>}</div>
                      <div className="submit-row response-logout-row"><button type="button" className="small-btn" onClick={logoutDiscord}>DISCORD LOGOUT</button></div>
                    </div>
                  )}
                </div>

                <div className="responder-ranking">
                  {attendingRankings.length > 0 && (
                    <section className="rankings-panel" aria-labelledby="attending-rankings-title">
                      <div className="card-heading ranking-heading"><div className="eyebrow">LIVE RANKING</div><h2 id="attending-rankings-title">Attending Rankings</h2><p>Members who selected <b>Attending</b>, ranked by available hours.</p></div>
                      <div className="ranking-list">
                        {attendingRankings.map((item) => (
                          <div className="ranking-item" key={`${item.rank}-${item.ign}`}>
                            <span className="ranking-position">#{item.rank}</span>
                            <span className="ranking-ign">{item.ign}</span>
                            <span className="ranking-hours">{item.hours ? `${item.hours} HRS` : 'HOURS: —'}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}

          {adminMode && (
            <section className="admin-panel">
              <div className="card-heading"><div className="eyebrow">ADMIN CONTROL</div><h2>Final Day Responses</h2><p>Manage attendance responses, add entries manually, export CSV, and remove responses when needed.</p></div>
              <div className="admin-layout">
                <div className="admin-main">
                  <AdminResponseForm deadline={deadline} adminPassword={adminPassword} onCreated={(entry) => { setEntries((old) => [...old, entry]); setAttendingRankings((old) => [...old, ...(entry.attendance === 'attending' ? [{ rank: old.length + 1, ign: entry.ign, hours: entry.hours }] : [])]); }} onResetLocked={() => loadAdminEntries().catch((error) => setDeleteMessage(error.message))} />
                </div>
                <div className="admin-results">
                  <div className="admin-results-head"><div><div className="eyebrow">RESPONSE LIST</div><h3>{entries.length} RESPONSE{entries.length === 1 ? '' : 'S'}</h3></div><div className="admin-results-actions"><button className="small-btn" type="button" onClick={() => exportCsv(entries)}>EXPORT CSV</button><button className="small-btn" type="button" onClick={() => loadAdminEntries().catch((error) => setDeleteMessage(error.message))}>REFRESH</button></div></div>
                  {deleteMessage && <div className={`notice ${deleteMessage.includes('successfully') ? 'good' : 'danger'}`}>{deleteMessage}</div>}
                  <div className="entry-list">{entries.length === 0 ? <div className="empty-state">No responses yet.</div> : entries.map((entry) => <AdminEntry key={entry.id} entry={entry} onSave={saveEntry} onDelete={deleteEntry} />)}</div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {submitPopup && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSubmitPopup(null); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title">
            <div className="eyebrow">RESPONSE SUBMITTED</div><h2 id="submit-modal-title">SUCCESS</h2><div className="notice good">✅ <b>{submitPopup.ign}</b> was submitted successfully.</div><p>Your response is now <b>🔒 LOCKED</b> and you are still <b>logged in to Discord</b>.</p><div className="confirm-actions"><button className="small-btn" type="button" onClick={() => setSubmitPopup(null)}>CLOSE</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleteBusy) cancelDelete(); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <div className="eyebrow">ADMIN ACTION</div><h2 id="delete-modal-title">DELETE RESPONSE?</h2><div className="notice danger">⚠️ <b>{deleteTarget.ign || 'This response'} will be permanently removed.</b></div><p>This action cannot be undone.</p><div className="confirm-actions"><button className="small-btn" type="button" onClick={cancelDelete} disabled={deleteBusy}>CANCEL</button><button className="small-btn danger-btn modal-delete-btn" type="button" onClick={confirmDelete} disabled={deleteBusy}>{deleteBusy ? 'DELETING…' : 'DELETE'}</button></div>{deleteMessage && <div className="notice danger">{deleteMessage}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminEntry({ entry, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...entry });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => setDraft({ ...entry }), [entry]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true); setMessage('');
    try {
      if (!draft.ign.trim() || !draft.attendance || !draft.pilot || (draft.pilot === 'have_pilot' && !draft.pilotName.trim())) throw new Error('Please complete the required fields.');
      await onSave(draft); setMessage('Saved.');
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  return (
    <article className="admin-entry">
      <div className="entry-top"><div className="entry-ign">{entry.ign}</div><div className="badge-row"><span className={`badge ${entry.locked ? 'danger' : 'good'}`}>{entry.locked ? '🔒 LOCKED' : '🔓 UNLOCKED'}</span></div></div>
      <div className="admin-entry-grid"><div className="field"><label>IGN</label><input value={draft.ign} onChange={(e) => update('ign', e.target.value)} /></div><ChoiceGroup title="Attendance" name={`attendance-${entry.id}`} value={draft.attendance} disabled={saving} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} /><ChoiceGroup title="Pilot" name={`pilot-${entry.id}`} value={draft.pilot} disabled={saving} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} /></div>
      <div className="admin-entry-grid"><div className="field"><label>Pilot Name</label><input value={draft.pilotName} onChange={(e) => update('pilotName', e.target.value)} /></div><div className="field"><label>Hours</label><input value={draft.hours} onChange={(e) => update('hours', e.target.value)} /></div></div>
      <div className="field"><label>Notes</label><textarea value={draft.notes} onChange={(e) => update('notes', e.target.value)} /></div>
      <div className="admin-entry-actions"><button className="small-btn" type="button" onClick={save} disabled={saving}>{saving ? 'SAVING…' : 'SAVE CHANGES'}</button><button className="small-btn danger-btn" type="button" onClick={() => onDelete(entry.id)}>DELETE</button></div>
      {message && <div className={`notice ${message === 'Saved.' ? 'good' : 'danger'}`}>{message}</div>}
    </article>
  );
}

function ChoiceGroup({ title, name, value, disabled, options, onChange }) {
  return (
    <div className="field">
      <label>{title} <span className="required">*</span></label>
      <div className="choices">
        {options.map(([valueOption, text], index) => (
          <div className="choice" key={valueOption}>
            <input id={`${name}-${index}`} type="radio" name={name} checked={value === valueOption} onChange={() => onChange(valueOption)} disabled={disabled} />
            <label htmlFor={`${name}-${index}`}>{text}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
