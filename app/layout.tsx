import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Create List',
  description: 'Build Nexus Mods collections from the browser.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
