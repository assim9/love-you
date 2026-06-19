import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A Gift of Love 💖 | For You',
  description: 'A special gift crafted with love, just for you. Click to discover the surprise waiting inside.',
  keywords: ['love', 'gift', 'surprise', 'romantic'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
