'use client';

import Link from 'next/link';

type Props = {
  href: string;
  /** Shown next to icon, e.g. "Import" */
  label?: string;
};

const uploadIcon = (
  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

/**
 * Shared header control for list pages: outline + brand color, upload icon + label (matches Students / Events / GEO).
 */
export default function ListPageCsvImportButton({ href, label = 'Import' }: Props) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#57068c] bg-white px-2.5 text-xs font-medium text-[#57068c] shadow-sm transition-colors hover:bg-purple-50 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
      title={`${label} from CSV`}
      aria-label={`${label} from CSV`}
    >
      {uploadIcon}
      <span>{label}</span>
    </Link>
  );
}
