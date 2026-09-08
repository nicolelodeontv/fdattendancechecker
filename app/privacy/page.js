import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | CHAOS FD Attendance Checker',
  description: 'Privacy information for the CHAOS Final Day Attendance Checker, including Discord authentication and attendance data.',
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <div className="legal-nav">
          <div className="eyebrow">LEGAL</div>
          <Link className="small-btn legal-close" href="/">CLOSE</Link>
        </div>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: September 9, 2026</p>

        <section>
          <h2>1. Information we collect</h2>
          <p>When you sign in with Discord, we receive the Discord account identifier and display name needed to associate your attendance response with your account. When you submit the form, we also collect the information you enter, such as your IGN, attendance choice, pilot details, hours, notes, and submission time.</p>
        </section>

        <section>
          <h2>2. How we use information</h2>
          <p>We use this information to operate the Final Day attendance process, prevent duplicate responses, keep submitted responses associated with the correct Discord account, manage the attendance list, and respond to administrative requests.</p>
        </section>

        <section>
          <h2>3. Storage and service providers</h2>
          <p>Attendance records are stored in the connected project data store. Discord is used for authentication. The website is hosted through Vercel.</p>
        </section>

        <section>
          <h2>4. Cookies and local storage</h2>
          <p>Essential authentication uses an HttpOnly, Secure Discord session cookie. The site may also use browser local storage to support the response interface.</p>
        </section>

        <section>
          <h2>5. Data sharing</h2>
          <p>We do not sell attendance information. Information may be processed by service providers that are necessary to operate the website, including Discord and Vercel.</p>
        </section>

        <section>
          <h2>6. Data retention and deletion</h2>
          <p>Attendance information is retained for as long as it is needed to run the current attendance process and related administrative records. Administrators may remove submitted responses through the admin controls.</p>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>The site uses HTTPS, Secure and HttpOnly authentication cookies, server-side environment variables for credentials, and server-side validation for attendance submissions. No Discord client secret, GitHub token, session secret, or admin environment password is embedded in client-side code.</p>
        </section>

        <section>
          <h2>8. Your choices</h2>
          <p>You can manually log out of Discord at any time using the logout control on the attendance page.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>For privacy questions or requests concerning attendance information, contact the administrator responsible for this attendance checker through the associated Discord server.</p>
        </section>
      </div>
    </main>
  );
}
