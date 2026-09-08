import './globals.css';
import { Inter, Roboto_Mono } from 'next/font/google';

const geist = Inter({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'FD Attendance Check Tracker',
  description: 'Final Discord attendance response tracker',
};

export default function RootLayout({ children }) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable}`}><body>{children}</body></html>;
} 
