'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ZoomReset() {
  const pathname = usePathname();

  useEffect(() => {
    // Scroll to top on route change to reset any offset from mobile zoom
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
