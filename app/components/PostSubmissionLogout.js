'use client';

import { useEffect, useState } from 'react';

export default function PostSubmissionLogout() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const saved = window.localStorage.getItem('fd_attendance_entry');
        if (!saved) {
          if (active) setVisible(false);
          return;
        }

        const res = await fetch('/api/auth/discord/me', { cache: 'no-store' });
        const data = await res.json();
        if (active) setVisible(Boolean(data.authenticated));
      } catch {
        if (active) setVisible(Boolean(window.localStorage.getItem('fd_attendance_entry')));
      }
    };

    check();
    const interval = window.setInterval(check, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function logoutDiscord() {
    await fetch('/api/auth/discord/me', { method: 'DELETE' }).catch(() => {});
    window.localStorage.removeItem('fd_attendance_entry');
    setVisible(false);
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <div className="post-submission-logout">
      <button className="small-btn" type="button" onClick={logoutDiscord}>DISCORD LOGOUT</button>
    </div>
  );
}
