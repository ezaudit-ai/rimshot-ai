import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'rimshot.ai',
  description: 'AI punchline/comeback generator with optional rimshot sound.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
