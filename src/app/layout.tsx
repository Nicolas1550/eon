import type { Metadata } from 'next';
import './globals.css';
import './genesis-world.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'GENESIS — The Living World | Five Biomes',
  description: 'GENESIS: explorá cinco biomas 3D creados en Blender y exportados a la web. Un laboratorio de mundos interactivos, nacido de EON.',
  openGraph: { title: 'GENESIS — The Living World', description: 'Awaken the world. Shape its future.', type: 'website', images: [{ url: '/og-genesis.jpg', width: 1200, height: 630, alt: 'GENESIS — The Living World' }] },
  twitter: { card: 'summary_large_image', images: ['/og-genesis.jpg'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
