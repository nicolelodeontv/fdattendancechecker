'use client';

import { useEffect, useState } from 'react';

export default function PostSubmissionControls() {
  const [entry, setEntry] = useState(null);
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    if (window.location.pathname !== '/') return;

    let active = true;
    fetch('/api/attendance', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.entry) return;
        setEntry(data.entry);
        setRankings(data.attendingRankings || []);
        document.body.classList.add('post-submission-active');
      })
      .catch(() => {});

    return () => {
      active = false;
      document.body.classList.remove('post-submission-active');
    };
  }, []);

  async function logoutDiscord() {
    await fetch('/api/auth/discord/me', { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem('fd_attendance_entry');
    setEntry(null);
    setRankings([]);
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
          <p>You are still logged in to Discord. You can log out below.</p>
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
