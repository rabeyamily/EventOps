import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

// Get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'clear':
      return 'bg-status-clear text-white';
    case 'one_strike':
      return 'bg-status-one-strike text-white';
    case 'blocked':
      return 'bg-status-blocked text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

// Format time (HH:MM)
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  return time;
}

