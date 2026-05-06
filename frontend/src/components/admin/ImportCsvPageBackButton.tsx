'use client';

import { useRouter } from 'next/navigation';

type Props = {
  href: string;
  /** Accessible label, e.g. "Back to Students" */
  label: string;
};

export default function ImportCsvPageBackButton({ href, label }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="p-2 transition-opacity hover:opacity-80"
      onClick={() => router.push(href)}
      aria-label={label}
      title={label}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          d="M15 18L9 12L15 6"
          stroke="#57068c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
