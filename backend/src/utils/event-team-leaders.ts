/** Join up to three lead organizer names for reports and summaries. */
export function formatEventTeamLeaderNames(event: {
  leadOrganizer?: { fullName?: string } | null;
  leadOrganizer2?: { fullName?: string } | null;
  leadOrganizer3?: { fullName?: string } | null;
}): string {
  const names = [event.leadOrganizer, event.leadOrganizer2, event.leadOrganizer3]
    .map((s) => s?.fullName)
    .filter((n): n is string => !!n && n.trim().length > 0);
  return names.length ? names.join(', ') : 'N/A';
}
