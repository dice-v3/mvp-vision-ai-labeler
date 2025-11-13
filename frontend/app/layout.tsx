import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vision AI Labeler',
  description: 'Web-based annotation tool for Vision AI Training Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
