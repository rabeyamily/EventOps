import { Op } from 'sequelize';
import type { WhereOptions } from 'sequelize';
import { Staff, StaffRole } from '../models/Staff';

/**
 * Sequelize `where` fragment: staff who may lead events (GEO), never admins.
 */
export function geoLeadOrganizerScope(): WhereOptions<any> {
  return {
    role: StaffRole.STAFF,
    [Op.or]: [
      { position: { [Op.iLike]: '%GEO%' } },
      { position: { [Op.is]: null } },
      { position: '' },
    ],
  };
}

export function isEligibleGeoLeadOrganizer(staff: Pick<Staff, 'role' | 'position'>): boolean {
  if (staff.role === StaffRole.ADMIN) return false;
  if (staff.role !== StaffRole.STAFF) return false;
  const p = (staff.position ?? '').trim().toUpperCase();
  if (p.length === 0) return true;
  return p.includes('GEO');
}

/** Strip trailing " lead" and characters unsafe inside LIKE patterns. */
function normalizeLeadOrganizerLabel(raw: string): string {
  let s = raw.trim();
  if (/\s+lead$/i.test(s)) {
    s = s.replace(/\s+lead$/i, '').trim();
  }
  return s.replace(/[%_\\]/g, '');
}

/**
 * Map calendar CSV "Lead Organizer" cell (often a first name) to a GEO staff row.
 */
export async function resolveCalendarCsvLeadOrganizer(
  label: string | undefined,
  fallbackGeo: Staff
): Promise<Staff> {
  if (!label?.trim()) return fallbackGeo;
  const q = normalizeLeadOrganizerLabel(label);
  if (!q) return fallbackGeo;

  const scope = geoLeadOrganizerScope();

  const byExact = await Staff.findOne({
    where: {
      [Op.and]: [
        scope,
        {
          [Op.or]: [
            { fullName: { [Op.iLike]: q } },
            { preferredName: { [Op.iLike]: q } },
          ],
        },
      ],
    },
  });
  if (byExact) return byExact;

  const byContains = await Staff.findOne({
    where: {
      [Op.and]: [
        scope,
        {
          [Op.or]: [
            { fullName: { [Op.iLike]: `%${q}%` } },
            { preferredName: { [Op.iLike]: `%${q}%` } },
          ],
        },
      ],
    },
    order: [['fullName', 'ASC']],
  });
  return byContains || fallbackGeo;
}

export async function getDefaultGeoLeadFallback(): Promise<Staff | null> {
  return Staff.findOne({
    where: geoLeadOrganizerScope(),
    order: [['fullName', 'ASC']],
  });
}

/**
 * Parse CSV "Lead Organizer" cell (e.g. "Priya" or "Rami, Lena") into up to 3 distinct GEO staff ids.
 */
export async function resolveCalendarCsvTeamLeaders(
  label: string | undefined,
  fallbackGeo: Staff
): Promise<{
  leadOrganizerId: string;
  leadOrganizer2Id: string | null;
  leadOrganizer3Id: string | null;
}> {
  if (!label?.trim()) {
    return {
      leadOrganizerId: fallbackGeo.id,
      leadOrganizer2Id: null,
      leadOrganizer3Id: null,
    };
  }

  const parts = label
    .split(/[,;/&]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (ids.length >= 3) break;
    const staff = await resolveCalendarCsvLeadOrganizer(part, fallbackGeo);
    if (seen.has(staff.id)) continue;
    seen.add(staff.id);
    ids.push(staff.id);
  }

  if (ids.length === 0) {
    ids.push(fallbackGeo.id);
  }

  return {
    leadOrganizerId: ids[0]!,
    leadOrganizer2Id: ids[1] ?? null,
    leadOrganizer3Id: ids[2] ?? null,
  };
}
