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
    ? `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useManilaClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'medium',
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
    x.pilotName,
    x.hours,
    x.notes,
    x.submittedAt ? new Date(x.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '',
    x.locked ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fd-attendance-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  const [adminPassword, setAdminPassword] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load tracker.');
      setDeadline(data.deadline);
      const saved = localStorage.getItem('fd_attendance_entry');
      if (saved) {
        try {
          const mine = JSON.parse(saved);
          setLockedEntry(mine);
          setForm({ ign: mine.ign, attendance: mine.attendance, pilot: mine.pilot, pilotName: mine.pilotName, hours: mine.hours, notes: mine.notes });
        } catch {
          localStorage.removeItem('fd_attendance_entry');
        }
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => (deadline ? Date.parse(deadline) - now : null), [deadline, now]);
  const closed = remaining !== null && remaining <= 0;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    if (!form.ign.trim() || !form.attendance || !form.pilot || (form.pilot === 'have_pilot' && !form.pilotName.trim())) {
      setMessage('Please complete the required fields.');
      return;
    }
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      localStorage.setItem('fd_attendance_entry', JSON.stringify(data.entry));
      setLockedEntry(data.entry);
      setDeadline(data.deadline);
      setMessage('Response submitted and locked.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function adminLogin(e) {
    e.preventDefault();
    setAdminError('');
    try {
      const res = await fetch('/api/attendance?admin=1', {
        headers: { 'x-admin-password': adminPassword },
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.status === 401) throw new Error('Incorrect admin password.');
      if (!res.ok) throw new Error(data.error || 'Admin login failed.');
      setEntries(data.entries || []);
      setDeadline(data.deadline);
      setAdminAuthed(true);
      setAdminOpen(true);
      sessionStorage.setItem('fd_admin', adminPassword);
    } catch (error) {
      setAdminError(error.message);
    }
  }

  useEffect(() => {
    const pw = sessionStorage.getItem('fd_admin');
    if (!pw) return;
    setAdminPassword(pw);
    setAdminAuthed(true);
    setAdminOpen(true);
    fetch('/api/attendance?admin=1', {
      headers: { 'x-admin-password': pw },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries);
        if (data.deadline) setDeadline(data.deadline);
      })
      .catch(() => {});
  }, []);

  async function saveEntry(entry) {
    const res = await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    setEntries((old) => old.map((x) => (x.id === entry.id ? data.entry : x)));
  }

  function deleteEntry(id) {
    const target = entries.find((entry) => entry.id === id);
    if (!target) return;
    setDeleteMessage('');
    setDeleteTarget(target);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteMessage('');
    try {
      const res = await fetch('/api/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      setEntries((old) => old.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteMessage('Response deleted successfully.');
    } catch (error) {
      setDeleteMessage(error.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  function cancelDelete() {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteMessage('');
  }

  function logoutAdmin() {
    sessionStorage.removeItem('fd_admin');
    setAdminPassword('');
    setAdminAuthed(false);
    setAdminOpen(false);
    setEntries([]);
    setAdminError('');
    setMessage('');
    setDeleteTarget(null);
    setDeleteMessage('');
  }

  const adminMode = adminOpen || adminAuthed;

  return (
    <div className="site-wrapper">
      <div className="shell">
        <header className="site-header">
          <div className="header-banner">
            <h1>FD ATTENDANCE CHECK TRACKER</h1>
            <span>{adminMode ? 'ADMIN / CONTROL' : 'FD / ATTENDANCE'}</span>
          </div>
          <div className="server-time-bar">
            <div className="server-left">
              <span className="live-dot" />
              <span className="server-label">Philippine Server Time</span>
              <span className="server-value">{clock}</span>
            </div>
            <span className="server-zone">Asia/Manila · UTC+8</span>
          </div>
        </header>

        <main className="content-card">
          {!adminMode && (
            <>
              <div className="card-heading">
                <div className="eyebrow">RESPONSE FORM</div>
                <h2>Final Discord Attendance</h2>
                <p>Complete your attendance, pilot, and availability details. Once submitted, your response is locked on this device.</p>
              </div>

              <div className="deadline">
                <div className="deadline-copy">{ICONS.hourglass} <b>Response deadline:</b> 48 hours from the start of this response period.</div>
                <div className="deadline-time">{closed ? 'DEADLINE PASSED' : formatCountdown(remaining ?? 0)}</div>
              </div>

              {!lockedEntry ? (
                <form className="form" onSubmit={submit}>
                  <div className="field">
                    <label>IGN <span className="required">*</span></label>
                    <input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" disabled={loading} />
                  </div>

                  <div className="grid-2">
                    <ChoiceGroup title="Attendance" name="attendance" value={form.attendance} disabled={loading} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} />
                    <ChoiceGroup title="Pilot" name="pilot" value={form.pilot} disabled={loading} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} />
                  </div>

                  <div className="grid-2">
                    <div className="field">
                      <label>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label>
                      <input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" disabled={loading || form.pilot !== 'have_pilot'} />
                    </div>
                    <div className="field">
                      <label>Hours</label>
                      <input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" disabled={loading} />
                    </div>
                  </div>

                  <div className="field">
                    <label>Notes <span>(optional)</span></label>
                    <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" disabled={loading} />
                  </div>

                  <div className="submit-row">
                    <button className="submit" type="submit" disabled={closed || loading}>SUBMIT RESPONSE</button>
                  </div>

                  {message && <div className={`notice ${message.includes('locked') ? 'good' : 'danger'}`}>{message}</div>}
                </form>
              ) : (
                <div className="form">
                  <div className="notice good"><span className="lock">{ICONS.lock}</span> Your response is locked after submission. You can no longer change it from this device.</div>
                  <div className="entry" style={{ marginTop: 10 }}>
                    <div className="entry-top">
                      <div className="entry-ign">{lockedEntry.ign}</div>
                      <span className="badge info">SUBMITTED {new Date(lockedEntry.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                    </div>
                    <div className="badge-row">
                      <span className={`badge ${lockedEntry.attendance === 'attending' ? 'good' : 'danger'}`}>{lockedEntry.attendance === 'attending' ? ICONS.yes : ICONS.no} {lockedEntry.attendance === 'attending' ? 'ATTENDING' : 'NOT ATTENDING'}</span>
                      <span className="badge info">{lockedEntry.pilot === 'have_pilot' ? ICONS.yes : ICONS.no} {lockedEntry.pilot === 'have_pilot' ? `PILOT: ${lockedEntry.pilotName}` : 'NO PILOT'}</span>
                      <span className="badge">HOURS: {lockedEntry.hours || '—'}</span>
                    </div>
                    {lockedEntry.notes && <div className="notice" style={{ marginTop: 9 }}>{lockedEntry.notes}</div>}
                  </div>
                </div>
              )}
            </>
          )}

          <section className="admin">
            <div className="admin-head">
              <div>
                <h3>ADMIN CONTROLS</h3>
                {adminAuthed && <div className="admin-sub">{entries.length} RESPONSE{entries.length === 1 ? '' : 'S'}</div>}
              </div>
              <div className="admin-head-actions">
                {adminOpen && adminAuthed && (
                  <>
                    <button className="small-btn export-btn" type="button" disabled={!entries.length} onClick={() => exportCsv(entries)}>EXPORT</button>
                    <button className="small-btn danger-btn" type="button" onClick={logoutAdmin}>LOGOUT</button>
                  </>
                )}
                <button className="small-btn" type="button" onClick={() => setAdminOpen((value) => !value)}>{adminOpen ? 'HIDE' : 'OPEN'}</button>
              </div>
            </div>

            {adminOpen && !adminAuthed && (
              <form className="admin-login" onSubmit={adminLogin}>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" />
                <button className="small-btn" type="submit">UNLOCK</button>
              </form>
            )}

            {adminError && adminOpen && <div className="notice danger">{adminError}</div>}

            {deleteMessage && <div className="notice good">{deleteMessage}</div>}

            {adminOpen && adminAuthed && (
              <div style={{ marginTop: 10 }}>
                <AdminResponseForm
                  deadline={deadline}
                  adminPassword={adminPassword}
                  onCreated={(entry, nextDeadline) => {
                    setEntries((old) => [...old, entry]);
                    if (nextDeadline) setDeadline(nextDeadline);
                  }}
                />

                <div className="notice good" style={{ marginTop: 10 }}>
                  Admin-created responses remain <b>UNLOCKED</b>. Respondent submissions remain <b>🔒 LOCKED</b>.
                </div>

                {entries.length === 0 ? (
                  <div className="notice" style={{ marginTop: 10 }}>No submitted responses yet. Use the admin response form above to add one.</div>
                ) : (
                  entries.map((entry) => <AdminEntry key={entry.id} entry={entry} onSave={saveEntry} onDelete={deleteEntry} />)
                )}
              </div>
            )}
          </section>
        </main>

        <footer className="site-footer">
          <p>FD Attendance Checker · Philippine Time · Responses lock after submit</p>
        </footer>
      </div>

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelDelete(); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <div className="eyebrow">ADMIN ACTION</div>
            <h2 id="delete-modal-title">DELETE RESPONSE?</h2>
            <p>Are you sure you want to delete <b>{deleteTarget.ign || 'this response'}</b>? This action cannot be undone.</p>
            {deleteMessage && <div className="notice danger">{deleteMessage}</div>}
            <div className="confirm-actions">
              <button className="small-btn" type="button" disabled={deleteBusy} onClick={cancelDelete}>CANCEL</button>
              <button className="small-btn danger-btn modal-delete-btn" type="button" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'DELETING…' : 'DELETE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceGroup({ title, name, value, disabled, options, onChange }) {
  return (
    <div className="field">
      <label>{title} <span className="required">*</span></label>
      <div className="choices">
        {options.map(([optionValue, text], index) => (
          <div className="choice" key={optionValue}>
            <input id={`${name}-${index}`} type="radio" name={name} checked={value === optionValue} onChange={() => onChange(optionValue)} disabled={disabled} />
            <label htmlFor={`${name}-${index}`}>{text}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminEntry({ entry, onSave, onDelete }) {
  const [draft, setDraft] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => setDraft(entry), [entry]);
  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await onSave(draft);
      setStatus('Saved');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry">
      <div className="entry-top">
        <div className="entry-ign">{entry.ign || 'Unnamed response'}</div>
        <div className="badge-row">
          <span className={`badge ${entry.locked ? 'info' : 'good'}`}>{entry.locked ? '🔒 LOCKED' : 'UNLOCKED'}</span>
          <span className="badge info">SUBMITTED {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</span>
        </div>
      </div>

      <div className="entry-fields">
        <div className="field"><label>IGN</label><input value={draft.ign} onChange={(e) => patch('ign', e.target.value)} placeholder="IGN" disabled={saving} /></div>
        <div className="field"><label>Attendance</label><select value={draft.attendance} onChange={(e) => patch('attendance', e.target.value)} disabled={saving}><option value="attending">✅ Attending</option><option value="not_attending">❌ Not Attending</option></select></div>
        <div className="field"><label>Pilot</label><select value={draft.pilot} onChange={(e) => patch('pilot', e.target.value)} disabled={saving}><option value="have_pilot">✅ Have Pilot</option><option value="no_pilot">❌ No Pilot</option></select></div>
        <div className="field"><label>Pilot Name</label><input value={draft.pilotName} onChange={(e) => patch('pilotName', e.target.value)} placeholder="Pilot name" disabled={saving} /></div>
        <div className="field"><label>Hours</label><input value={draft.hours} onChange={(e) => patch('hours', e.target.value)} placeholder="Hours" disabled={saving} /></div>
        <div className="field admin-notes-field"><label>Notes</label><textarea value={draft.notes} onChange={(e) => patch('notes', e.target.value)} placeholder="Notes" disabled={saving} /></div>
      </div>

      <div className="admin-actions">
        <button className="small-btn" type="button" disabled={saving} onClick={save}>{saving ? 'SAVING…' : 'SAVE'}</button>
        <button className="small-btn danger-btn" type="button" disabled={saving} onClick={() => onDelete(entry.id)}>DELETE</button>
        {status && <span className={`badge ${status === 'Saved' ? 'good' : 'danger'}`}>{status}</span>}
      </div>
    </div>
  );
}
