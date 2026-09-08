import './globals.css';
import './centered-layout.css';
import './security-accessibility.css';
import Link from 'next/link';

export const metadata = {
  metadataBase: new URL('https://fdattendancechecker.vercel.app'),
  title: {
    default: 'CHAOS FD Attendance Checker',
    template: '%s | CHAOS FD Attendance Checker',
  },
  description: 'Discord-authenticated Final Day attendance response tracker for CHAOS.',
  applicationName: 'CHAOS FD Attendance Checker',
  keywords: ['CHAOS', 'Final Day', 'attendance', 'Discord'],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'CHAOS FD Attendance Checker',
    description: 'Discord-authenticated Final Day attendance response tracker for CHAOS.',
    url: 'https://fdattendancechecker.vercel.app/',
    siteName: 'CHAOS FD Attendance Checker',
    type: 'website',
    images: [{ url: '/social-preview.svg', width: 1200, height: 630, alt: 'CHAOS FD Attendance Checker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CHAOS FD Attendance Checker',
    description: 'Discord-authenticated Final Day attendance response tracker for CHAOS.',
    images: ['/social-preview.svg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <span>CHAOS FD Attendance Checker</span>
          <nav className="site-footer-links" aria-label="Legal">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
