'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/loginPage.png)' }}
    >
      <div className="absolute inset-0 bg-[#57068c]/30" />
      <div className="text-center relative z-10">
        <h2 className="text-2xl font-semibold text-white drop-shadow-lg">Something went wrong!</h2>
        <p className="mt-2 text-white/80">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-white/20 backdrop-blur-sm border-2 border-white/90 px-6 py-2 text-white font-semibold hover:bg-white hover:text-[#57068c] transition-all duration-300 shadow-lg"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

