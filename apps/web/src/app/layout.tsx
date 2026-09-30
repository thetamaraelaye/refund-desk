import type { Metadata } from 'next';
import { IBM_Plex_Mono, Newsreader, Public_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const publicSans = Public_Sans({ variable: '--font-public-sans', subsets: ['latin'] });

// Only the decision receipt is set in mono.
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

// Larkfield's editorial headings in the store; never used in the console or for numbers.
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Larkfield',
  description: 'Home, kitchen and lifestyle goods, with help for every order',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${plexMono.variable} ${newsreader.variable}`}
    >
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
