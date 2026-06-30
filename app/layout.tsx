import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Simple Collection Manager',
    template: '%s | Simple Collection Manager'
  },
  description: 'Create, edit, and publish Nexus Mods collections from the browser.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg'
  },
  openGraph: {
    title: 'Simple Collection Manager',
    description: 'Create, edit, and publish Nexus Mods collections from the browser.',
    siteName: 'Simple Collection Manager',
    images: [
      {
        url: '/social-thumb.jpg',
        width: 1920,
        height: 1080,
        alt: 'Simple Collection Manager'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Simple Collection Manager',
    description: 'Create, edit, and publish Nexus Mods collections from the browser.',
    images: ['/social-thumb.jpg']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
