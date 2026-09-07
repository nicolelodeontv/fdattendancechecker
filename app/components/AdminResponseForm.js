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
    ? `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AdminResponseForm({ deadline, adminPassword, onCreated, onResetLocked }) {
  const [form, setForm] = useState(EMPTY);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [submitPopup, setSubmitPopup] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => (deadline ? Date.parse(deadline) - now : 0), [deadline, now]);
  const closed = remaining <= 0;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');

      const submittedIgn = data.entry?.ign || form.ign.trim();
      setForm(EMPTY);
      setMessage('Response submitted successfully. This admin-created response is not locked.');
      setSubmitPopup({ ign: submittedIgn });
      onCreated?.(data.entry, data.deadline);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetLockedResponses() {
    setMessage('');
    if (resetting) return;
    const confirmed = window.confirm('Reset all locked respondent responses? This will remove every locked response and allow those Discord users to submit again. Admin-created unlocked responses will remain.');
    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await fetch('/api/attendance?admin=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action: 'reset_locked' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset responses.');
      setMessage(`Reset complete. ${data.removed || 0} locked response${data.removed === 1 ? '' : 's'} removed.`);
      onResetLocked?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="admin-response-form">
      <div className="card-heading">
        <div className="eyebrow">RESPONSE FORM</div>
        <h2>Final Day Attendance</h2>
        <p>Complete your attendance, pilot, and availability details. Admin-created responses are not locked.</p>
      </div>

      <div className="deadline">
        <div className="deadline-copy">
          {ICONS.hourglass} <b>Response deadline:</b> 48 hours from the start of this response period.
        </div>
        <div className="deadline-time">{closed ? 'DEADLINE PASSED' : formatCountdown(remaining)}</div>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>IGN <span className="required">*</span></label>
          <input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" disabled={saving || resetting} />
        </div>

        <div className="grid-2">
          <ChoiceGroup title="Attendance" name="admin-attendance" value={form.attendance} disabled={saving || resetting} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} />
          <ChoiceGroup title="Pilot" name="admin-pilot" value={form.pilot} disabled={saving || resetting} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label>
            <input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" disabled={saving || resetting} />
          </div>
          <div className="field">
            <label>Hours</label>
            <input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" disabled={saving || resetting} />
          </div>
        </div>

        <div className="field">
          <label>Notes <span>(optional)</span></label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" disabled={saving || resetting} />
        </div>

        <div className="submit-row">
          <button className="submit" type="submit" disabled={saving || resetting}>{saving ? 'SAVING…' : 'SUBMIT RESPONSE'}</button>
        </div>

        <div className="admin-reset-actions">
          <button className="small-btn reset-locked-btn" type="button" onClick={resetLockedResponses} disabled={saving || resetting}>
            {resetting ? 'RESETTING…' : 'RESET ALL LOCKED RESPONSES'}
          </button>
        </div>

        {message && <div className={`notice ${message.includes('successfully') || message.includes('Reset complete') ? 'good' : 'danger'}`}>{message}</div>}
      </form>

      {submitPopup && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setSubmitPopup(null); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="admin-submit-modal-title">
            <div className="eyebrow">RESPONSE SUBMITTED</div>
            <h2 id="admin-submit-modal-title">SUCCESS</h2>
            <div className="notice good">✅ <b>{submitPopup.ign}</b> was added successfully.</div>
            <p>This admin-created response is <b>UNLOCKED</b> and can be edited or deleted from the admin controls.</p>
            <div className="confirm-actions">
              <button className="small-btn" type="button" onClick={() => setSubmitPopup(null)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </section>
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
