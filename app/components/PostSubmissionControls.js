'use client';

import { useEffect, useState } from 'react';

function readSavedEntry() {
  try {
    const raw = window.localStorage.getItem('fd_attendance_entry');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function PostSubmissionControls() {
  const [entry, setEntry] = useState(null);
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    if (window.location.pathname !== '/') return undefined;

    let active = true;
    const refresh = async () => {
      const savedEntry = readSavedEntry();
      if (!savedEntry) {
        if (active) {
          setEntry(null);
          setRankings([]);
          document.body.classList.remove('post-submission-active');
        }
        return;
      }

      try {
        const [authRes, attendanceRes] = await Promise.all([
          fetch('/api/auth/discord/me', { cache: 'no-store' }),
          fetch('/api/attendance', { cache: 'no-store' }),
        ]);
        const auth = await authRes.json();
        const data = await attendanceRes.json();
        if (!active) return;

        if (!auth.authenticated) {
          setEntry(null);
          setRankings([]);
          document.body.classList.remove('post-submission-active');
          return;
        }

        setEntry(data.entry || savedEntry);
        setRankings(data.attendingRankings || []);
        document.body.classList.add('post-submission-active');
      } catch {
        if (!active) return;
        setEntry(savedEntry);
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.body.classList.remove('post-submission-active');
    };
  }, []);

  async function logoutDiscord() {
    await fetch('/api/auth/discord/me', { method: 'DELETE' }).catch(() => {});
    window.localStorage.removeItem('fd_attendance_entry');
    document.body.classList.remove('post-submission-active');
    window.location.reload();
  }

  if (!entry) return null;

  return (
    <section className="post-submission-panel" aria-labelledby="post-submission-title">
      <div className="post-submission-head">
        <div>
          <div className="eyebrow">RESPONSE SUBMITTED</div>
          <h2 id="post-submission-title">Your response is locked</h2>
          <p>Your Discord session is still active.</p>
        </div>
        <button className="small-btn" type="button" onClick={logoutDiscord}>DISCORD LOGOUT</button>
      </div>

      {rankings.length > 0 && (
        <div className="post-submission-ranking">
          <div className="card-heading ranking-heading">
            <div className="eyebrow">LIVE RANKING</div>
            <h2>Attending Rankings</h2>
            <p>Members who selected <b>Attending</b>, ranked by available hours.</p>
          </div>
          <div className="ranking-list">
            {rankings.map((item) => (
              <div className="ranking-item" key={`${item.rank}-${item.ign}`}>
                <span className="ranking-position">#{item.rank}</span>
                <span className="ranking-ign">{item.ign}</span>
                <span className="ranking-hours">{item.hours ? `${item.hours} hours` : 'Hours: —'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
