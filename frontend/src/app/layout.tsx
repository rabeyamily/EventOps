import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ZoomReset from '@/components/ZoomReset';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VSP EventOps - Staff Operations Platform',
  description: 'Staff-only operations platform for managing visiting NYU students, events, and attendance',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ZoomReset />
        {children}
      </body>
    </html>
  );
}

