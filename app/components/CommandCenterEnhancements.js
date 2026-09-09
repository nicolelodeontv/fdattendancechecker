'use client';

import { useEffect } from 'react';

const REFRESH_MS = 20000;

function hours(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function makeStat(label, value) {
  const el = document.createElement('div');
  el.className = 'command-stat';
  el.innerHTML = '<span class="command-stat-value"></span><span class="command-stat-label"></span>';
  el.querySelector('.command-stat-value').textContent = value;
  el.querySelector('.command-stat-label').textContent = label;
  return el;
}

function getStats(entries) {
  const attending = entries.filter((x) => x.attendance === 'attending');
  const withPilot = attending.filter((x) => x.pilot === 'have_pilot');
  const totalHours = attending.reduce((sum, x) => sum + hours(x.hours), 0);
  const noPilot = attending.length - withPilot.length;
  const lowHours = attending.filter((x) => hours(x.hours) < 10).length;
  const attendanceRate = entries.length ? attending.length / entries.length : 0;
  const pilotRate = attending.length ? withPilot.length / attending.length : 0;
  const readiness = entries.length ? Math.round((attendanceRate * 0.6 + pilotRate * 0.4) * 100) : 0;
  return { attending, withPilot, totalHours, noPilot, lowHours, readiness };
}

function getPublicStats(rankings) {
  const totalHours = rankings.reduce((sum, x) => sum + hours(x.hours), 0);
  return { attendingCount: rankings.length, totalHours, leader: rankings[0]?.ign || '—' };
}

function sortedRankings(entries) {
  return entries
    .filter((x) => x.attendance === 'attending')
    .slice()
    .sort((a, b) => hours(b.hours) - hours(a.hours) || String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')))
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

function clearOld(root, className) {
  root.querySelectorAll(`.${className}`).forEach((node) => node.remove());
}

function removeMiniBurnEverywhere() {
  document.querySelectorAll('.command-mini-burn,.mini-burn-list,.mini-burn-row,.mini-burn-remove').forEach((node) => node.remove());
}

function buildLeaderboard(panel, entries, rankings, currentIgn = '', showPilot = true, limit = 0) {
  const list = panel.querySelector('.command-leaderboard-list');
  if (!list) return;
  const ranked = rankings.length ? rankings : sortedRankings(entries);
  const visible = limit > 0 ? ranked.slice(0, limit) : ranked;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No attending responses yet.';
    list.appendChild(empty);
    return;
  }

  visible.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'ranking-item';
    if (item.rank <= 3) row.classList.add(`ranking-top-${item.rank === 1 ? 'one' : item.rank === 2 ? 'two' : 'three'}`);
    if (currentIgn && item.ign === currentIgn) row.classList.add('ranking-current-user');

    const pos = document.createElement('span');
    pos.className = 'ranking-position';
    pos.textContent = `#${item.rank}`;

    const ign = document.createElement('span');
    ign.className = 'ranking-ign';
    ign.textContent = item.ign || '—';
    if (currentIgn && item.ign === currentIgn) {
      const you = document.createElement('em');
      you.className = 'current-user-tag';
      you.textContent = 'YOU';
      ign.appendChild(you);
    }

    const status = document.createElement('span');
    status.className = 'ranking-status';
    status.textContent = showPilot ? (item.pilot === 'have_pilot' ? '🎮 PILOT' : '⚠ NO PILOT') : '✅ ATTENDING';

    const hrs = document.createElement('span');
    hrs.className = 'ranking-hours';
    hrs.textContent = hours(item.hours) ? `${hours(item.hours)} HRS` : 'HOURS: —';

    row.append(pos, ign, status, hrs);
    list.appendChild(row);
  });
}

function createLeaderboard(title, entries, rankings, currentIgn, showPilot, canToggle) {
  const panel = document.createElement('section');
  panel.className = 'command-ranking-panel command-live-leaderboard';

  const heading = document.createElement('div');
  heading.className = 'ranking-heading command-section-head';
  heading.innerHTML = '<div><div class="eyebrow">LIVE LEADERBOARD</div><h2></h2></div><div class="command-ranking-meta"></div>';
  heading.querySelector('h2').textContent = title;

  const list = document.createElement('div');
  list.className = 'command-leaderboard-list command-scroll-panel';
  panel.append(heading, list);

  const ranked = rankings.length ? rankings : sortedRankings(entries);
  const useLimit = canToggle && ranked.length > 10;
  let showingAll = false;
  const render = () => buildLeaderboard(panel, entries, ranked, currentIgn, showPilot, useLimit && !showingAll ? 10 : 0);

  render();
  heading.querySelector('.command-ranking-meta').textContent = `${ranked.length} ATTENDING · ${Math.round(getPublicStats(ranked).totalHours * 10) / 10} HRS`;

  if (useLimit) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'command-toggle';
    toggle.textContent = `SHOW ALL ${ranked.length}`;
    toggle.onclick = () => {
      showingAll = !showingAll;
      toggle.textContent = showingAll ? 'SHOW TOP 10' : `SHOW ALL ${ranked.length}`;
      render();
    };
    panel.appendChild(toggle);
  }

  return panel;
}

function getCurrentIgn() {
  try {
    return JSON.parse(localStorage.getItem('fd_attendance_entry') || 'null')?.ign || '';
  } catch {
    return '';
  }
}

function createDashboard(mode, entries, rankings, deadline, currentIgn) {
  const root = document.createElement('section');
  root.className = `command-dashboard command-${mode}-dashboard command-dashboard-mount`;

  const title = document.createElement('div');
  title.className = 'command-title-row';
  title.innerHTML = '<div><div class="eyebrow"></div><h3></h3></div><span class="command-live"><i></i> LIVE · 20S</span>';
  title.querySelector('.eyebrow').textContent = mode === 'admin' ? 'ADMIN COMMAND CENTER' : 'FD COMMAND CENTER';
  title.querySelector('h3').textContent = mode === 'admin' ? 'FD Readiness' : 'Attendance Overview';
  root.appendChild(title);

  if (mode === 'admin') {
    const s = getStats(entries);
    const summary = document.createElement('div');
    summary.className = 'command-stats command-admin-summary';
    [['RESPONSES', entries.length], ['ATTENDING', s.attending.length], ['NOT ATTENDING', entries.length - s.attending.length], ['WITH PILOT', s.withPilot.length], ['NO PILOT', s.noPilot], ['TOTAL HOURS', `${Math.round(s.totalHours * 10) / 10} HRS`]].forEach(([label, value]) => summary.appendChild(makeStat(label, value)));
    root.appendChild(summary);

    const readiness = document.createElement('div');
    readiness.className = 'command-readiness';
    readiness.innerHTML = '<div><span>FD READINESS</span><b></b></div><div class="readiness-track"><span></span></div><small>60% attendance coverage + 40% pilot coverage among attending members.</small>';
    readiness.querySelector('b').textContent = `${s.readiness}%`;
    readiness.querySelector('.readiness-track span').style.width = `${s.readiness}%`;
    root.appendChild(readiness);

    const warnings = document.createElement('div');
    warnings.className = 'command-warnings';
    if (s.noPilot > 0) {
      const x = document.createElement('span');
      x.className = 'warning-chip';
      x.textContent = `⚠ ${s.noPilot} ATTENDING WITHOUT PILOT`;
      warnings.appendChild(x);
    }
    if (s.lowHours > 0) {
      const x = document.createElement('span');
      x.className = 'warning-chip';
      x.textContent = `⚠ ${s.lowHours} BELOW 10 HRS`;
      warnings.appendChild(x);
    }
    if (!warnings.children.length) {
      const x = document.createElement('span');
      x.className = 'good-chip';
      x.textContent = '✓ NO CURRENT FD WARNINGS';
      warnings.appendChild(x);
    }
    root.appendChild(warnings);
    root.appendChild(createLeaderboard('Attending Rankings', entries, rankings, '', true, false));
  } else {
    const p = getPublicStats(rankings);
    const summary = document.createElement('div');
    summary.className = 'command-stats';
    [['ATTENDING', p.attendingCount], ['TOTAL HOURS', `${Math.round(p.totalHours * 10) / 10} HRS`], ['LEADER', p.leader], ['STATUS', 'LIVE']].forEach(([label, value]) => summary.appendChild(makeStat(label, value)));
    root.appendChild(summary);
    root.appendChild(createLeaderboard('Attending Rankings', [], rankings, currentIgn, false, true));
  }

  if (deadline) {
    const d = document.createElement('div');
    d.className = 'command-deadline';
    const l = document.createElement('span');
    l.textContent = 'RESPONSE DEADLINE';
    const r = document.createElement('b');
    r.textContent = new Date(deadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    d.append(l, r);
    root.appendChild(d);
  }
  return root;
}

function enhancePublic(data) {
  const layout = document.querySelector('.responder-layout');
  if (!layout) return;
  clearOld(layout, 'command-dashboard-mount');
  const oldRanking = layout.querySelector('.responder-ranking');
  if (oldRanking) oldRanking.style.display = 'none';
  layout.insertBefore(createDashboard('public', [], data.attendingRankings || [], data.deadline, getCurrentIgn()), layout.firstChild);
  removeMiniBurnEverywhere();
}

function enhanceAdmin(data) {
  const layout = document.querySelector('.admin-layout');
  if (!layout) return;
  clearOld(layout, 'command-dashboard-mount');
  layout.insertBefore(createDashboard('admin', data.entries || [], data.attendingRankings || [], data.deadline, ''), layout.firstChild);

  const results = document.querySelector('.admin-results');
  const list = results?.querySelector('.entry-list');
  if (!list) {
    removeMiniBurnEverywhere();
    return;
  }
  results.classList.add('command-admin-results');

  let toolbar = results.querySelector('.command-response-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'command-filter-toolbar command-response-toolbar';
    toolbar.innerHTML = '<input type="search" placeholder="SEARCH IGN" aria-label="Search response IGN"><select aria-label="Filter responses"><option value="all">ALL RESPONSES</option><option value="attending">ATTENDING</option><option value="not_attending">NOT ATTENDING</option><option value="pilot">WITH PILOT</option><option value="no_pilot">NO PILOT</option></select><select aria-label="Sort responses"><option value="recent">SORT: RECENT</option><option value="hours">SORT: HOURS ↓</option><option value="ign">SORT: IGN A–Z</option></select>';
    results.insertBefore(toolbar, list);

    const apply = () => {
      const q = toolbar.querySelector('input').value.trim().toLowerCase();
      const filter = toolbar.querySelectorAll('select')[0].value;
      const sort = toolbar.querySelectorAll('select')[1].value;
      const cards = [...list.querySelectorAll('.admin-entry')];

      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        const ign = card.querySelector('.entry-ign')?.textContent?.trim().toLowerCase() || '';
        const okSearch = !q || ign.includes(q);
        const okFilter = filter === 'all'
          || (filter === 'attending' && text.includes('attending') && !text.includes('not attending'))
          || (filter === 'not_attending' && text.includes('not attending'))
          || (filter === 'pilot' && (text.includes('have pilot') || text.includes('pilot:')))
          || (filter === 'no_pilot' && text.includes('no pilot'));
        card.hidden = !(okSearch && okFilter);
      });

      const visible = cards.filter((x) => !x.hidden);
      if (sort !== 'recent') {
        visible
          .sort((a, b) => sort === 'ign'
            ? (a.querySelector('.entry-ign')?.textContent || '').localeCompare(b.querySelector('.entry-ign')?.textContent || '')
            : hours(b.textContent) - hours(a.textContent))
          .forEach((x) => list.appendChild(x));
      }
      decorateAdminCards(list);
    };

    toolbar.querySelectorAll('input,select').forEach((el) => {
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
    setTimeout(apply, 0);
  }

  decorateAdminCards(list);
  removeMiniBurnEverywhere();
}

function decorateAdminCards(list) {
  list.querySelectorAll('.admin-entry').forEach((card) => {
    if (card.dataset.commandDecorated) return;
    card.dataset.commandDecorated = '1';
    card.classList.add('command-admin-entry');
    const top = card.querySelector('.entry-top');
    if (!top) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'command-collapse-btn';
    btn.textContent = 'COLLAPSE';
    btn.setAttribute('aria-expanded', 'true');
    btn.addEventListener('click', () => {
      const collapsed = card.classList.toggle('is-collapsed');
      btn.textContent = collapsed ? 'EXPAND' : 'COLLAPSE';
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
    top.appendChild(btn);
  });
}

function enhanceCurrentMode() {
  removeMiniBurnEverywhere();
  const admin = document.querySelector('.admin-panel');
  if (admin) {
    const password = sessionStorage.getItem('fd_admin') || '';
    if (!password) return;
    fetch('/api/attendance?admin=1', { headers: { 'x-admin-password': password }, cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) enhanceAdmin(data); })
      .catch(() => {});
    return;
  }

  fetch('/api/attendance', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { if (data) enhancePublic(data); })
    .catch(() => {});
}

export default function CommandCenterEnhancements() {
  useEffect(() => {
    let stopped = false;
    let timer = null;
    let scheduled = false;

    const run = () => {
      if (stopped || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (!stopped) enhanceCurrentMode();
      });
    };

    run();
    timer = window.setInterval(run, REFRESH_MS);

    const observer = new MutationObserver(() => {
      removeMiniBurnEverywhere();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
