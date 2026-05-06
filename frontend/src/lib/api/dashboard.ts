import apiClient, { ApiResponse, handleApiError } from '../api-client';

export interface AdminDashboardData {
  currentCohort?: string;
  students: {
    total: number;
    byCampus: { campus: string; count: number }[];
    byStatus: { status: string; count: number }[];
    strikes?: {
      zero: number;
      one: number;
      twoPlus: number;
    };
    oneStrike: number;
    blocked: number;
  };
  events: {
    total: number;
    upcoming: number;
    today: number;
    locked: number;
    next: any[];
    todayList?: any[];
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    rate: number;
  };
  strikes: {
    total: number;
    active: number;
    excused: number;
    thisWeek: number;
  };
  staff: {
    total: number;
    admins: number;
  };
  atRiskStudents: any[];
  recentActivity: any[];
  actionItems?: Array<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
    eventId?: string;
    eventName?: string;
    count: number;
  }>;
  studentsMissingInfo?: Array<{
    id: string;
    fullName: string;
    nyuEmail: string;
  }>;
}

export interface LiveEventDashboardData {
  event: {
    id: string;
    name: string;
    startDate: string;
    location: string;
    isLocked: boolean;
    departedAt?: string;
    leadOrganizer?: { fullName: string };
  };
  stats: {
    total: number;
    present: number;
    absent: number;
    notMarked: number;
    attendanceRate: number;
  };
  atRisk: {
    presentWithStrikes: number;
    absentWithStrikes: number;
    blockedPresent: number;
  };
  students: {
    present: any[];
    absent: any[];
    notMarked: any[];
  };
}

export interface RiskDashboardData {
  summary: {
    oneStrike: number;
    blocked: number;
    recentStrikes: number;
  };
  oneStrikeStudents: any[];
  blockedStudents: any[];
  recentStrikes: any[];
  highAbsenceEvents: any[];
}

// Get admin dashboard
export const getAdminDashboard = async (cohort?: string): Promise<AdminDashboardData> => {
  try {
    const params = cohort ? { cohort } : {};
    const response = await apiClient.get<ApiResponse<AdminDashboardData>>('/dashboard/admin', { params });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch dashboard');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get live event dashboard
export const getLiveEventDashboard = async (eventId: string): Promise<LiveEventDashboardData> => {
  try {
    const response = await apiClient.get<ApiResponse<LiveEventDashboardData>>(`/dashboard/event/${eventId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch event dashboard');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get risk dashboard
export const getRiskDashboard = async (): Promise<RiskDashboardData> => {
  try {
    const response = await apiClient.get<ApiResponse<RiskDashboardData>>('/dashboard/risk');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch risk dashboard');
  } catch (error) {
    throw handleApiError(error);
  }
};

export interface SemesterReportData {
  semester: string;
  summary: {
    totalEvents: number;
    totalStudents: number;
    overallAttendanceRate: number;
    totalPresent: number;
    totalAssigned: number;
    totalStrikes: number;
    blockedStudents: number;
    oneStrikeStudents: number;
  };
  mostSuccessfulEvent: {
    id: string;
    name: string;
    startDate: string;
    location: string;
    leadOrganizer: string;
    totalAssigned: number;
    present: number;
    absent: number;
    attendanceRate: number;
    strikeCount: number;
  } | null;
  leastSuccessfulEvent: {
    id: string;
    name: string;
    startDate: string;
    attendanceRate: number;
  } | null;
  events: Array<{
    id: string;
    name: string;
    startDate: string;
    location: string;
    leadOrganizer: string;
    totalAssigned: number;
    present: number;
    absent: number;
    attendanceRate: number;
    strikeCount: number;
  }>;
  topEvents: Array<any>;
}

export interface EventSummaryData {
  event: {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendanceMode: string;
    isLocked: boolean;
    leadOrganizer?: { fullName: string; email: string };
    leadOrganizer2?: { fullName: string; email: string };
    leadOrganizer3?: { fullName: string; email: string };
    /** Pre-joined names from API when present */
    teamLeadNames?: string;
    semester?: string;
    academicYear?: number;
  };
  attendance: {
    totalAssigned: number;
    present: number;
    absent: number;
    notMarked: number;
    attendanceRate: number;
  };
  absentWithNotes: Array<{
    studentName: string;
    studentEmail: string;
    note: string;
    markedBy: string;
  }>;
  atRiskStudents: Array<{
    id: string;
    fullName: string;
    nyuEmail: string;
    strikeCount: number;
    status: string;
    attendanceStatus: string;
  }>;
  strikes: Array<{
    id: string;
    studentName: string;
    studentEmail: string;
    isExcused: boolean;
    reason?: string;
  }>;
  campusBreakdown: Array<{
    campus: string;
    present: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  presentStudents: Array<{
    id: string;
    fullName: string;
    nyuEmail: string;
    campus: string;
  }>;
  absentStudents: Array<{
    id: string;
    fullName: string;
    nyuEmail: string;
    campus: string;
    note?: string;
  }>;
}

export const getSemesterReport = async (semester?: string): Promise<SemesterReportData> => {
  try {
    const params = semester ? { semester } : {};
    const response = await apiClient.get<ApiResponse<SemesterReportData>>('/dashboard/semester-report', { params });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch semester report');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getEventSummary = async (eventId: string): Promise<EventSummaryData> => {
  try {
    const response = await apiClient.get<ApiResponse<EventSummaryData>>(`/dashboard/event-summary/${eventId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch event summary');
  } catch (error) {
    throw handleApiError(error);
  }
};

