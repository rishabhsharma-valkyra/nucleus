import type { Metadata } from 'next';
import '../styles/globals.css';
import Providers from './providers';
import GlobalChatbot from '@/components/GlobalChatbot';

export const metadata: Metadata = {
  title: 'Valkyra Nucleus — Command Center',
  description: 'Valkyra Nucleus Command Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-canvas" />
        <div className="bg-grid" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <Providers>{children}<GlobalChatbot /></Providers>
      </body>
    </html>
  );
}

