import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'EON — The Living City | Urban Reconstruction V7',
  description: 'A city that breathes. Procedural urban worlds, cinematic 3D exploration and persistent cities. EON Urban Reconstruction V7.',
  openGraph: { title: 'EON — The Living City', description: 'Don’t just watch the future. Build it.', type: 'website', images: [{ url: '/og-eon.jpg', width: 1200, height: 630, alt: 'EON — The Living City' }] },
  twitter: { card: 'summary_large_image', images: ['/og-eon.jpg'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
