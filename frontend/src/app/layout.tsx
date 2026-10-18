import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KrishiUnnati — Crop help in your language',
  description: 'A voice-first crop help assistant for farmers.',
  applicationName: 'KrishiUnnati',
  icons: { icon: '/branding/krishiunnati-mark.png' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
