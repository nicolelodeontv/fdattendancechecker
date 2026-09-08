export const metadata = {
  title: 'Terms & Conditions | CHAOS FD Attendance Checker',
  description: 'Terms and conditions for using the CHAOS Final Day Attendance Checker.',
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <div className="eyebrow">LEGAL</div>
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-updated">Last updated: September 9, 2026</p>

        <section>
          <h2>1. Purpose</h2>
          <p>This website is provided to collect and manage Final Day attendance responses for the associated Discord community. By using the site, you agree to use it only for legitimate attendance and administrative purposes.</p>
        </section>

        <section>
          <h2>2. Accurate information</h2>
          <p>You are responsible for submitting accurate information, including your Discord identity, IGN, attendance choice, pilot information, availability, and notes. Do not submit information on behalf of another person without authorization.</p>
        </section>

        <section>
          <h2>3. Discord authentication</h2>
          <p>Discord authentication is required for responder submissions. Your response is linked to the Discord account used to sign in so that duplicate submissions can be prevented and responses can be associated with the correct member.</p>
        </section>

        <section>
          <h2>4. Submitted responses</h2>
          <p>Responder submissions are locked after successful submission. Administrative users may edit or remove responses through the protected admin controls when necessary to manage the attendance process.</p>
        </section>

        <section>
          <h2>5. Availability and changes</h2>
          <p>The site is provided on an as-available basis. The attendance deadline, required fields, authentication flow, or other site features may be changed when necessary to operate the event.</p>
        </section>

        <section>
          <h2>6. Prohibited use</h2>
          <p>You must not attempt to bypass authentication, submit automated or abusive traffic, interfere with the service, access protected administrative functionality without authorization, or use the site to collect information for unrelated purposes.</p>
        </section>

        <section>
          <h2>7. Privacy</h2>
          <p>Use of the site is also governed by the <a href="/privacy">Privacy Policy</a>, which explains how authentication, attendance information, cookies, and optional analytics are handled.</p>
        </section>

        <section>
          <h2>8. Acceptance</h2>
          <p>By using the attendance checker, you acknowledge these terms and agree to follow the rules and instructions of the associated Discord community.</p>
        </section>
      </div>
    </main>
  );
}
