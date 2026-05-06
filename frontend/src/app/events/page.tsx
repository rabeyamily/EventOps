'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, CardContent, Badge, Spinner } from '@/components/ui';
import { getEvents, EventFilters } from '@/lib/api/events';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import { Event } from '@/types';
import { formatDate } from '@/lib/utils';
import { formatEventTeamLine } from '@/lib/event-team-leaders';
import { useIsAdmin } from '@/hooks/useAuth';
import ListPageCsvImportButton from '@/components/admin/ListPageCsvImportButton';

function parseSemesterString(s: string): { semester: string; academicYear: number } | null {
  const m = s.match(/^(Spring|Fall)\s+(\d{4})$/);
  if (!m) return null;
  return { semester: m[1], academicYear: parseInt(m[2], 10) };
}

export default function EventsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const viewingSemester = useViewingSemesterStore((s) => s.viewingSemester);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 1000,
    total: 0,
    totalPages: 1,
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const semesterData = viewingSemester ? parseSemesterString(viewingSemester) : null;
      const filters: EventFilters = {
        page: 1,
        limit: 1000,
        ...(semesterData && {
          semester: semesterData.semester as 'Spring' | 'Fall',
          academicYear: semesterData.academicYear,
        }),
      };

      if (isAdmin) {
        const response = await getEvents(filters);
        setEvents(response.data || []);
        setPagination(response.pagination || { page: 1, limit: 1000, total: 0, totalPages: 1 });
      } else {
        // GEO mode: explicitly merge default + past result sets so passed events are always visible.
        // Past fetch is intentionally cross-semester (no semester filter), otherwise a future semester
        // like "Fall 2026" returns zero past rows even though older events exist.
        const { semester: _semester, academicYear: _academicYear, ...baseFilters } = filters;
        const [baseResponse, pastResponse] = await Promise.all([
          getEvents(filters),
          getEvents({ ...baseFilters, past: true }),
        ]);

        const byId = new Map<string, Event>();
        (baseResponse.data || []).forEach((event) => byId.set(event.id, event));
        (pastResponse.data || []).forEach((event) => byId.set(event.id, event));

        const mergedEvents = Array.from(byId.values()).sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

        setEvents(mergedEvents);
        setPagination({
          page: 1,
          limit: 1000,
          total: mergedEvents.length,
          totalPages: 1,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [viewingSemester, isAdmin]);

  useEffect(() => {
    if (viewingSemester) {
      setEvents([]);
      fetchEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
  }, [fetchEvents, viewingSemester]);



  // Group events by month
  const groupEventsByMonth = (events: Event[]) => {
    const grouped: { [key: string]: Event[] } = {};
    
    events.forEach((event) => {
      const date = new Date(event.startDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(event);
    });

    // Sort events within each month by date
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
    });

    // Convert to array and sort by month
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, events]) => {
        const date = new Date(events[0].startDate);
        return {
          monthKey: key,
          monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          events,
        };
      });
  };

  const eventsByMonth = groupEventsByMonth(events);

  const isPastEvent = (event: Event): boolean => {
    const endOrStart = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endOrStart.setHours(0, 0, 0, 0);
    return endOrStart.getTime() < today.getTime();
  };

  if (loading && !hasLoadedOnce.current) {
    return (
      <ProtectedRoute>
        <PageLayout title="Events">
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Events"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm hover:text-[#57068c] hover:border-[#57068c]"
              onClick={() => router.push('/events/calendar')}
            >
              Calendar View
            </Button>
            {isAdmin && (
              <>
                <ListPageCsvImportButton href="/events/import" />
                <Button
                  onClick={() => router.push('/events/new')}
                  variant="primary"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  Add Event
                </Button>
              </>
            )}
          </div>
        }
      >
        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 sm:p-4 text-center">
            <p className="text-sm text-red-800">{error}</p>
            <Button onClick={fetchEvents} size="sm" className="mt-3 sm:mt-4">
              Retry
            </Button>
          </div>
        )}

        {/* Inline loading indicator for refetches */}
        {loading && hasLoadedOnce.current && (
          <div className="flex justify-center py-4">
            <Spinner size="sm" className="text-[#57068c]" />
          </div>
        )}

        {/* Events List - Grouped by Month */}
        {!loading && !error && (
          <>
            {eventsByMonth.length === 0 ? (
              <Card>
                <CardContent>
                  <p className="text-center text-gray-500 py-6 sm:py-8 text-sm">
                    No events found.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {eventsByMonth.map(({ monthName, events: monthEvents }, index) => (
                  <div key={monthName}>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3">
                      {monthName}
                    </h2>
                    <div className="space-y-1">
                      {monthEvents.map((event) => {
                        const isPast = isPastEvent(event);
                        const teamLine = formatEventTeamLine(event);
                        return (
                        <Link key={event.id} href={`/events/${event.id}`}>
                          <div
                            className={`rounded-lg border p-3 transition-all cursor-pointer ${
                              isPast
                                ? 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3
                                  className={`text-sm sm:text-base font-semibold mb-1.5 ${
                                    isPast ? 'text-gray-500' : 'text-gray-900'
                                  }`}
                                >
                                  {event.name}
                                </h3>
                                <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${isPast ? 'text-gray-500' : 'text-gray-600'}`}>
                                  <span>
                                    {event.endDate && new Date(event.endDate).toDateString() !== new Date(event.startDate).toDateString() 
                                      ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`
                                      : formatDate(event.startDate)}
                                  </span>
                                  {event.startTime && (
                                    <span>
                                      {event.startTime}
                                      {event.endTime && <span className="hidden sm:inline"> - {event.endTime}</span>}
                                    </span>
                                  )}
                                  {event.location && (
                                    <span className="truncate max-w-[120px] sm:max-w-none">
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                                {teamLine && (
                                  <p className="mt-1 text-xs text-gray-500">{teamLine}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isPast && (
                                  <Badge variant="default" size="sm">
                                    Past
                                  </Badge>
                                )}
                                {event.isLocked && (
                                  <Badge variant="warning" size="sm">
                                    Locked
                                  </Badge>
                                )}
                                {event.departedAt && (
                                  <Badge variant="success" size="sm">
                                    Departed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </PageLayout>
    </ProtectedRoute>
  );
}
