'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = { ign: '', attendance: '', pilot: '', pilotName: '', hours: '', notes: '' };
const ICONS = { yes: '✅', no: '❌', hourglass: '⏳' };

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

export default function AdminResponseForm({ deadline, adminPassword, onCreated, onResetLocked }) {
  const [form, setForm] = useState(EMPTY);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [submitPopup, setSubmitPopup] = useState(null);
  const [resetPopup, setResetPopup] = useState(null);
  const [lockedEntries, setLockedEntries] = useState([]);
  const [selectedResetId, setSelectedResetId] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadLockedEntries();
  }, [adminPassword]);

  const remaining = useMemo(() => (deadline ? Date.parse(deadline) - now : 0), [deadline, now]);
  const closed = remaining <= 0;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function loadLockedEntries() {
    if (!adminPassword) return;
    try {
      const res = await fetch('/api/attendance?admin=1', {
        headers: { 'x-admin-password': adminPassword },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) return;
      setLockedEntries((data.entries || []).filter((entry) => entry.locked));
    } catch {}
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.ign.trim() || !form.attendance || !form.pilot || (form.pilot === 'have_pilot' && !form.pilotName.trim())) {
      setMessage('Please complete the required fields.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/attendance?admin=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      const submittedIgn = data.entry?.ign || form.ign.trim();
      setForm(EMPTY);
      setMessage('Response submitted successfully. This admin-created response is not locked.');
      setSubmitPopup({ ign: submittedIgn });
      onCreated?.(data.entry, data.deadline);
      await loadLockedEntries();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function requestResetSelected() {
    setMessage('');
    if (resetting || !selectedResetId) return;
    const target = lockedEntries.find((entry) => String(entry.id) === String(selectedResetId));
    if (!target) return;
    setResetPopup({ type: 'one', target });
  }

  function requestResetAll() {
    setMessage('');
    if (resetting) return;
    setResetPopup({ type: 'all' });
  }

  async function confirmReset() {
    if (!resetPopup || resetting) return;
    const resetType = resetPopup.type;
    const target = resetPopup.target;
    setResetPopup(null);
    setResetting(true);
    try {
      const body = resetType === 'one' ? { action: 'reset_one', id: target.id } : { action: 'reset_locked' };
      const res = await fetch('/api/attendance?admin=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset responses.');
      setSelectedResetId('');
      setMessage(resetType === 'one'
        ? `${target.ign || 'Response'} has been reset. They can submit again.`
        : `Reset complete. ${data.removed || 0} locked response${data.removed === 1 ? '' : 's'} removed.`);
      await loadLockedEntries();
      onResetLocked?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setResetting(false);
    }
  }

  const fieldStyle = { position: 'relative', zIndex: 60, pointerEvents: 'auto' };

  return (
    <section className="admin-response-form" style={{ position: 'relative', zIndex: 20, pointerEvents: 'auto' }}>
      <div className="card-heading">
        <div className="eyebrow">RESPONSE FORM</div>
        <h2>Final Day Attendance</h2>
        <p>Complete your attendance, pilot, and availability details. Admin-created responses are not locked.</p>
      </div>

      <div className="deadline">
        <div className="deadline-copy">{ICONS.hourglass} <b>Response deadline:</b> 48 hours from the start of this response period.</div>
        <div className="deadline-time">{closed ? 'DEADLINE PASSED' : formatCountdown(remaining)}</div>
      </div>

      <form className="form" onSubmit={submit} style={{ position: 'relative', zIndex: 50, pointerEvents: 'auto' }}>
        <div className="field" style={fieldStyle}>
          <label style={{ pointerEvents: 'none' }}>IGN <span className="required">*</span></label>
          <input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" disabled={saving} style={fieldStyle} />
        </div>

        <div className="grid-2">
          <ChoiceGroup title="Attendance" name="admin-attendance" value={form.attendance} disabled={saving} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} />
          <ChoiceGroup title="Pilot" name="admin-pilot" value={form.pilot} disabled={saving} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} />
        </div>

        <div className="grid-2">
          <div className="field" style={fieldStyle}>
            <label style={{ pointerEvents: 'none' }}>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label>
            <input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" disabled={saving} style={fieldStyle} />
          </div>
          <div className="field" style={fieldStyle}>
            <label style={{ pointerEvents: 'none' }}>Hours</label>
            <input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" disabled={saving} style={fieldStyle} />
          </div>
        </div>

        <div className="field" style={fieldStyle}>
          <label style={{ pointerEvents: 'none' }}>Notes <span>(optional)</span></label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" disabled={saving} style={fieldStyle} />
        </div>

        <div className="submit-row">
          <button className="submit" type="submit" disabled={saving || resetting}>{saving ? 'SAVING…' : 'SUBMIT RESPONSE'}</button>
        </div>

        <div className="admin-reset-actions">
          <label className="admin-reset-label" htmlFor="reset-response-select">RESET A SPECIFIC RESPONSE</label>
          <div className="admin-reset-select-row">
            <select id="reset-response-select" className="small-select reset-response-select" value={selectedResetId} onChange={(e) => setSelectedResetId(e.target.value)} disabled={saving || resetting || !lockedEntries.length}>
              <option value="">SELECT LOCKED RESPONSE</option>
              {lockedEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.ign || 'Unnamed response'}</option>)}
            </select>
            <button className="small-btn reset-locked-btn" type="button" onClick={requestResetSelected} disabled={saving || resetting || !selectedResetId}>{resetting ? 'RESETTING…' : 'RESET SELECTED'}</button>
          </div>
          <button className="small-btn reset-locked-btn reset-all-btn" type="button" onClick={requestResetAll} disabled={saving || resetting}>{resetting ? 'RESETTING…' : 'RESET ALL LOCKED RESPONSES'}</button>
        </div>

        {message && <div className={`notice ${message.includes('successfully') || message.includes('Reset complete') || message.includes('has been reset') ? 'good' : 'danger'}`}>{message}</div>}
      </form>

      {submitPopup && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setSubmitPopup(null); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="admin-submit-modal-title">
            <div className="eyebrow">RESPONSE SUBMITTED</div>
            <h2 id="admin-submit-modal-title">SUCCESS</h2>
            <div className="notice good">✅ <b>{submitPopup.ign}</b> was added successfully.</div>
            <p>This admin-created response is <b>UNLOCKED</b> and can be edited or deleted from the admin controls.</p>
            <div className="confirm-actions"><button className="small-btn" type="button" onClick={() => setSubmitPopup(null)}>CLOSE</button></div>
          </div>
        </div>
      )}

      {resetPopup && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !resetting) setResetPopup(null); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
            <div className="eyebrow">ADMIN ACTION</div>
            <h2 id="reset-modal-title">{resetPopup.type === 'one' ? 'RESET RESPONSE?' : 'RESET ALL RESPONSES?'}</h2>
            <div className="notice danger"><b>⚠️ {resetPopup.type === 'one' ? `${resetPopup.target?.ign || 'This respondent'} will be reset.` : 'All locked respondent responses will be removed.'}</b></div>
            <p>{resetPopup.type === 'one' ? 'This removes the selected locked response and allows that Discord user to submit again.' : 'This removes every locked respondent response. Admin-created unlocked responses will remain.'}</p>
            <div className="confirm-actions">
              <button className="small-btn" type="button" onClick={() => setResetPopup(null)} disabled={resetting}>CANCEL</button>
              <button className="small-btn danger-btn modal-delete-btn" type="button" onClick={confirmReset} disabled={resetting}>{resetting ? 'RESETTING…' : 'RESET'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChoiceGroup({ title, name, value, disabled, options, onChange }) {
  return (
    <div className="field" style={{ position: 'relative', zIndex: 55 }}>
      <label style={{ pointerEvents: 'none' }}>{title} <span className="required">*</span></label>
      <div className="choices" style={{ position: 'relative', zIndex: 56 }}>
        {options.map(([valueOption, text], index) => (
          <div className="choice" key={valueOption}>
            <input id={`${name}-${index}`} type="radio" name={name} checked={value === valueOption} onChange={() => onChange(valueOption)} disabled={disabled} />
            <label htmlFor={`${name}-${index}`} style={{ pointerEvents: 'auto' }}>{text}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
