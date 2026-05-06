import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/loginPage.png)' }}
    >
      <div className="absolute inset-0 bg-[#57068c]/30" />
      <div className="text-center relative z-10">
        <h1 className="text-6xl font-bold text-white drop-shadow-lg">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-white/90">Page Not Found</h2>
        <p className="mt-2 text-white/80">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-md bg-white/20 backdrop-blur-sm border-2 border-white/90 px-6 py-2 text-white font-semibold hover:bg-white hover:text-[#57068c] transition-all duration-300 shadow-lg"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

