import './globals.css';
import './centered-layout.css';
import './security-accessibility.css';
import './live-ranking.css';
import './command-center.css';
import './force-ui.css';
import './response-list-fix.css';
import './major-layout-fix.css';
import './command-center-layout-fix.css';
import CommandCenterEnhancements from './components/CommandCenterEnhancements';

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
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
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
        <CommandCenterEnhancements />
        <footer className="site-footer">
          <span>CHAOS FD Attendance Checker</span>
          <span>Created by <a href="https://discord.com/users/396080330702061588" target="_blank" rel="noopener noreferrer">Michol</a></span>
        </footer>
      </body>
    </html>
  );
}
