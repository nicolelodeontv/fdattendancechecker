'use client';

import { useEffect } from 'react';

function parseHours(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)\s*HRS?/i);
  return match ? Number(match[1]) : 0;
}

function makeStat(label, value) {
  const el = document.createElement('div');
  el.className = 'command-stat';
  el.innerHTML = `<span class="command-stat-value">${value}</span><span class="command-stat-label">${label}</span>`;
  return el;
}

function enhancePublicRanking(root) {
  const panel = root.querySelector('.rankings-panel');
  const list = root.querySelector('.ranking-list');
  if (!panel || !list) return;

  panel.classList.add('command-ranking-panel');
  list.classList.add('command-scroll-panel');
  list.querySelectorAll('.ranking-item').forEach((item) => {
    const position = item.querySelector('.ranking-position')?.textContent || '';
    item.classList.toggle('ranking-top-one', position.includes('#1'));
    item.classList.toggle('ranking-top-two', position.includes('#2'));
    item.classList.toggle('ranking-top-three', position.includes('#3'));
  });

  let summary = panel.querySelector('.ranking-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'ranking-summary';
    panel.insertBefore(summary, panel.querySelector('.ranking-heading')?.nextSibling || list);
  }
  const items = [...list.querySelectorAll('.ranking-item')];
  const totalHours = items.reduce((sum, item) => sum + parseHours(item.textContent), 0);
  summary.replaceChildren(
    makeStat('ATTENDING', items.length),
    makeStat('TOTAL HOURS', `${totalHours} HRS`),
    makeStat('LEADER', items[0]?.querySelector('.ranking-ign')?.textContent?.trim() || '—')
  );
}

function enhanceAdmin(root) {
  const results = root.querySelector('.admin-results');
  const list = results?.querySelector('.entry-list');
  if (!results || !list) return;

  results.classList.add('command-admin-results');

  let toolbar = results.querySelector('.command-filter-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'command-filter-toolbar';
    toolbar.innerHTML = `
      <input class="command-search" type="search" placeholder="SEARCH IGN" aria-label="Search response IGN" />
      <select class="command-filter" aria-label="Filter responses">
        <option value="all">ALL RESPONSES</option>
        <option value="attending">ATTENDING</option>
        <option value="not_attending">NOT ATTENDING</option>
        <option value="pilot">WITH PILOT</option>
        <option value="no_pilot">NO PILOT</option>
      </select>
      <select class="command-sort" aria-label="Sort responses">
        <option value="default">DEFAULT ORDER</option>
        <option value="hours_desc">HOURS ↓</option>
        <option value="hours_asc">HOURS ↑</option>
        <option value="ign">IGN A–Z</option>
      </select>`;
    results.insertBefore(toolbar, list);

    const applyFilters = () => {
      const search = toolbar.querySelector('.command-search').value.trim().toLowerCase();
      const filter = toolbar.querySelector('.command-filter').value;
      const sort = toolbar.querySelector('.command-sort').value;
      const entries = [...list.querySelectorAll('.admin-entry')];

      entries.forEach((entry) => {
        const text = entry.textContent.toLowerCase();
        const ign = entry.querySelector('.entry-ign')?.textContent?.trim().toLowerCase() || '';
        const attendanceMatch = filter === 'all' || (filter === 'attending' && text.includes('attending') && !text.includes('not attending')) || (filter === 'not_attending' && text.includes('not attending')) || (filter === 'pilot' && text.includes('have pilot')) || (filter === 'no_pilot' && text.includes('no pilot'));
        const searchMatch = !search || ign.includes(search);
        entry.hidden = !(attendanceMatch && searchMatch);
      });

      const visible = entries.filter((entry) => !entry.hidden);
      if (sort !== 'default') {
        visible.sort((a, b) => {
          if (sort === 'ign') return (a.querySelector('.entry-ign')?.textContent || '').localeCompare(b.querySelector('.entry-ign')?.textContent || '');
          const ah = parseHours(a.textContent);
          const bh = parseHours(b.textContent);
          return sort === 'hours_asc' ? ah - bh : bh - ah;
        }).forEach((entry) => list.appendChild(entry));
      }
      updateAdminSummary(results, visible);
    };

    toolbar.querySelectorAll('input, select').forEach((control) => control.addEventListener('input', applyFilters));
    toolbar.querySelectorAll('select').forEach((control) => control.addEventListener('change', applyFilters));
  }

  list.querySelectorAll('.admin-entry').forEach((entry) => {
    if (entry.dataset.commandEnhanced) return;
    entry.dataset.commandEnhanced = '1';
    entry.classList.add('command-admin-entry');
    const top = entry.querySelector('.entry-top');
    if (!top) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'command-collapse-btn';
    toggle.textContent = 'COLLAPSE';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.addEventListener('click', () => {
      const collapsed = entry.classList.toggle('is-collapsed');
      toggle.textContent = collapsed ? 'EXPAND' : 'COLLAPSE';
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
    top.appendChild(toggle);
  });

  updateAdminSummary(results, [...list.querySelectorAll('.admin-entry')].filter((entry) => !entry.hidden));
}

function updateAdminSummary(results, entries) {
  let summary = results.querySelector('.command-admin-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'command-admin-summary';
    const head = results.querySelector('.admin-results-head');
    if (head) head.insertAdjacentElement('afterend', summary);
    else results.prepend(summary);
  }
  const attending = entries.filter((entry) => /\bATTENDING\b/.test(entry.textContent) && !/NOT ATTENDING/.test(entry.textContent)).length;
  const pilot = entries.filter((entry) => /HAVE PILOT/.test(entry.textContent) || /PILOT:/.test(entry.textContent)).length;
  const totalHours = entries.reduce((sum, entry) => sum + parseHours(entry.textContent), 0);
  summary.replaceChildren(
    makeStat('VISIBLE', entries.length),
    makeStat('ATTENDING', attending),
    makeStat('WITH PILOT', pilot),
    makeStat('HOURS', `${totalHours} HRS`)
  );
}

export default function CommandCenterEnhancements() {
  useEffect(() => {
    let scheduled = false;
    const upgrade = () => {
      scheduled = false;
      enhancePublicRanking(document);
      enhanceAdmin(document);
    };
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(upgrade);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    upgrade();
    return () => observer.disconnect();
  }, []);

  return null;
}
