import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="legal-page not-found-page">
      <div className="legal-card">
        <div className="eyebrow">ERROR 404</div>
        <h1>Page not found</h1>
        <p>The page you requested does not exist or may have moved.</p>
        <div className="legal-actions">
          <Link className="small-btn" href="/">BACK TO ATTENDANCE CHECKER</Link>
          <Link className="small-btn" href="/privacy">PRIVACY POLICY</Link>
        </div>
      </div>
    </main>
  );
}
