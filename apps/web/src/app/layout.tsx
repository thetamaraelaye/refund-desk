import type { Metadata } from 'next';
import { IBM_Plex_Mono, Public_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const publicSans = Public_Sans({ variable: '--font-public-sans', subsets: ['latin'] });

// Only the decision receipt is set in mono.
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Refund Desk',
  description: 'Refund requests decided by written policy from order records, explained by AI',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
