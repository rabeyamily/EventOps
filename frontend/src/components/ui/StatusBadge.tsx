import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status: 'clear' | 'one_strike' | 'blocked';
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const statusConfig = {
    clear: {
      bg: 'bg-status-clear', // green
    },
    one_strike: {
      bg: 'bg-status-one-strike', // yellow/amber
    },
    blocked: {
      bg: 'bg-status-blocked', // red
    },
  };

  const config = statusConfig[status];

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        config.bg,
        sizeClasses[size]
      )}
      title={status === 'clear' ? 'Clear' : status === 'one_strike' ? '1 Strike' : 'Blocked'}
    />
  );
};

export default StatusBadge;

