import { Spinner } from '@/components/ui';

export default function FullScreenLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#57068c] gap-6">
      <div className="flex flex-col items-center gap-1 select-none">
        <span
          className="text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tight leading-none text-white"
          style={{ letterSpacing: '-0.02em' }}
        >
          VSP EventOps
        </span>
        <span
          className="text-[clamp(0.65rem,2vw,0.9rem)] tracking-[0.25em] uppercase text-white/80 font-medium"
          style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
        >
          NYU Abu Dhabi
        </span>
      </div>
      <Spinner size="lg" className="text-white/70" />
    </div>
  );
}


