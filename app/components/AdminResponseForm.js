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

export default function AdminResponseForm({ deadline, adminPassword, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

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

      setForm(EMPTY);
      setMessage('Response submitted successfully. This admin-created response is not locked.');
      onCreated?.(data.entry, data.deadline);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-response-form">
      <div className="card-heading">
        <div className="eyebrow">RESPONSE FORM</div>
        <h2>Final Discord Attendance</h2>
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
          <input value={form.ign} onChange={(e) => update('ign', e.target.value)} placeholder="CHAOS Michol" disabled={saving} />
        </div>

        <div className="grid-2">
          <ChoiceGroup title="Attendance" name="admin-attendance" value={form.attendance} disabled={saving} options={[["attending", ICONS.yes + ' Attending'], ["not_attending", ICONS.no + ' Not Attending']]} onChange={(value) => update('attendance', value)} />
          <ChoiceGroup title="Pilot" name="admin-pilot" value={form.pilot} disabled={saving} options={[["have_pilot", ICONS.yes + ' Have Pilot'], ["no_pilot", ICONS.no + ' No Pilot']]} onChange={(value) => update('pilot', value)} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Pilot Name <span className="required">{form.pilot === 'have_pilot' ? '*' : ''}</span></label>
            <input value={form.pilotName} onChange={(e) => update('pilotName', e.target.value)} placeholder="Pilot IGN" disabled={saving || form.pilot !== 'have_pilot'} />
          </div>
          <div className="field">
            <label>Hours</label>
            <input value={form.hours} onChange={(e) => update('hours', e.target.value)} placeholder="e.g. 14" disabled={saving} />
          </div>
        </div>

        <div className="field">
          <label>Notes <span>(optional)</span></label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything we should know?" disabled={saving} />
        </div>

        <div className="submit-row">
          <button className="submit" type="submit" disabled={saving}>{saving ? 'SAVING…' : 'SUBMIT RESPONSE'}</button>
        </div>

        {message && <div className={`notice ${message.includes('successfully') ? 'good' : 'danger'}`}>{message}</div>}
      </form>
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
