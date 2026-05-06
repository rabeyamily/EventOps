import type { Event } from '@/types';

type LeadRef = { fullName?: string } | undefined;

function leaderNamesFromEvent(event: {
  leadOrganizer?: LeadRef;
  leadOrganizer2?: LeadRef;
  leadOrganizer3?: LeadRef;
  teamLeaders?: Array<{ fullName?: string }>;
}): string[] {
  const names: string[] = [];
  for (const ref of event.teamLeaders || []) {
    const n = ref?.fullName?.trim();
    if (n && n !== 'Test Staff Member' && !names.includes(n)) names.push(n);
  }
  for (const ref of [event.leadOrganizer, event.leadOrganizer2, event.leadOrganizer3]) {
    const n = ref?.fullName?.trim();
    if (n && n !== 'Test Staff Member' && !names.includes(n)) names.push(n);
  }
  return names;
}

/** Comma-separated names for lists and reports. */
export function formatEventTeamLeadNames(event: Parameters<typeof leaderNamesFromEvent>[0]): string {
  const names = leaderNamesFromEvent(event);
  return names.length ? names.join(', ') : '';
}

/** "Team A, B, C" for event cards, or null if none. */
export function formatEventTeamLine(event: Parameters<typeof leaderNamesFromEvent>[0]): string | null {
  const names = leaderNamesFromEvent(event);
  return names.length ? `Team ${names.join(', ')}` : null;
}
