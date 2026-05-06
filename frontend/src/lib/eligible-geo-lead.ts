import type { Staff } from '@/types';

/** True if this person may be assigned as event lead (GEO staff only, never admins). */
export function isEligibleGeoLeadOrganizer(staff: Pick<Staff, 'role' | 'position'>): boolean {
  if (staff.role !== 'staff') return false;
  const p = (staff.position ?? '').trim().toUpperCase();
  if (p.length === 0) return true;
  return p.includes('GEO');
}
