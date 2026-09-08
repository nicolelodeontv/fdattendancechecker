'use client';

import { useEffect, useState } from 'react';

const CONSENT_KEY = 'fd_cookie_consent_v1';

function loadAnalytics() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('script[data-fd-analytics]')) return;

  const insights = document.createElement('script');
  insights.src = '/_vercel/insights/script.js';
  insights.defer = true;
  insights.dataset.fdAnalytics = 'true';
  document.head.appendChild(insights);

  const speed = document.createElement('script');
  speed.src = '/_vercel/speed-insights/script.js';
  speed.defer = true;
  speed.dataset.fdSpeedInsights = 'true';
  document.head.appendChild(speed);
}

export default function SiteEnhancements() {
  const [consent, setConsent] = useState(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    setConsent(saved || null);
    if (saved === 'accepted') loadAnalytics();
  }, []);

  const choose = (value) => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    if (value === 'accepted') loadAnalytics();
  };

  if (consent) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-label="Cookie and analytics consent">
      <div className="cookie-consent-copy">
        <strong>COOKIE &amp; ANALYTICS SETTINGS</strong>
        <p>
          This site uses essential cookies for Discord sign-in and optional privacy-friendly analytics to understand visits and performance. Analytics stays off until you allow it.
          See our <a href="/privacy">Privacy Policy</a> for details.
        </p>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="small-btn" onClick={() => choose('declined')}>DECLINE</button>
        <button type="button" className="small-btn" onClick={() => choose('accepted')}>ALLOW ANALYTICS</button>
      </div>
    </div>
  );
}
