// User types
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'staff' | 'admin';
  phone?: string;
}

// Student types
export interface Student {
  id: string;
  fullName: string;
  preferredName?: string;
  photoUrl?: string;
  nyuEmail: string;
  nNumber?: string;
  campus: 'NYC' | 'Shanghai';
  uaePhone?: string;
  internationalPhone?: string;
  emergencyContact?: string;
  altEmergencyContact?: string;
  cohort?: string; // Comma-separated list of cohorts
  primaryCohort?: string; // The most recent/primary cohort
  // Academic Info
  school?: string;
  major?: string;
  academicLevel?: string;
  gpa?: number;
  admitTerm?: string;
  // Personal Info
  birthdate?: string;
  citizenship?: string;
  passportCountry?: string;
  gender?: string;
  address?: string;
  // Strike Info
  strikeCount: number;
  status: 'clear' | 'one_strike' | 'blocked';
  // Audit fields
  createdByStaffId?: string;
  updatedByStaffId?: string;
  createdBy?: {
    id: string;
    fullName: string;
    email?: string;
  };
  updatedBy?: {
    id: string;
    fullName: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Event types
export type AttendanceMode = 'bus_based';
export type Semester = 'Spring' | 'Fall';

export interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  leadOrganizerId: string;
  leadOrganizer2Id?: string | null;
  leadOrganizer3Id?: string | null;
  leadOrganizer?: {
    id: string;
    fullName: string;
    email?: string;
  };
  leadOrganizer2?: {
    id: string;
    fullName: string;
    email?: string;
  };
  leadOrganizer3?: {
    id: string;
    fullName: string;
    email?: string;
  };
  teamLeaderIds?: string[];
  assignedGeoIds?: string[];
  teamLeaders?: {
    id: string;
    fullName: string;
    email?: string;
  }[];
  attendanceMode: AttendanceMode;
  notes?: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedByStaffId?: string;
  lockedBy?: {
    id: string;
    fullName: string;
    email?: string;
  };
  lockReason?: string;
  departedAt?: string;
  semester?: Semester;
  academicYear?: number;
  createdAt: string;
  updatedAt: string;
}

// Attendance types
export interface Attendance {
  id: string;
  eventId: string;
  studentId: string;
  status: 'present' | 'absent' | 'not_marked';
  markedByStaffId: string;
  notes?: string;
  markedAt: string;
  isHandOffMode: boolean;
  createdAt: string;
  updatedAt: string;
}

// Strike types
export interface Strike {
  id: string;
  studentId: string;
  eventId: string;
  reason?: string;
  isExcused: boolean;
  excusedByStaffId?: string;
  excusedAt?: string;
  excusedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Staff types
export interface Staff {
  id: string;
  fullName: string;
  preferredName?: string;
  email: string;
  nyuEmail?: string;
  classYear?: string;
  major?: string;
  minor?: string;
  notes?: string;
  role: 'staff' | 'admin';
  position?: string; // e.g., "GEO" (Global Education Officer)
  phone?: string;
  whatsapp?: string;
  uaePhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


