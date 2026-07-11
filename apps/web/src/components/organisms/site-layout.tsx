import type { ReactNode } from 'react';

import { Header } from '@/components/organisms/header';

interface SiteLayoutProps {
  children: ReactNode;
  showLogo?: boolean;
}

export function SiteLayout({ children, showLogo = true }: SiteLayoutProps) {
  return (
    <div className="min-h-screen bg-kaist-white">
      <Header showLogo={showLogo} />
      <main>{children}</main>
    </div>
  );
}
