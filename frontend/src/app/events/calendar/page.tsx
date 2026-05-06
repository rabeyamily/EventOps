'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getCalendarEvents } from '@/lib/api/events';
import { getStudentsAtRisk } from '@/lib/api/strikes';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import { Event } from '@/types';

function parseSemesterString(s: string): { semester: string; academicYear: number } | null {
  const m = s.match(/^(Spring|Fall)\s+(\d{4})$/);
  if (!m) return null;
  return { semester: m[1], academicYear: parseInt(m[2], 10) };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
}

export default function EventCalendarPage() {
  const router = useRouter();
  const viewingSemester = useViewingSemesterStore((s) => s.viewingSemester);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [strikeStats, setStrikeStats] = useState({ oneStrike: 0, blocked: 0 });

  const semesterData = viewingSemester ? parseSemesterString(viewingSemester) : null;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    if (!semesterData) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const currentSem = semesterData;
      const semesterMonths: number[] = [];
      if (currentSem.semester === 'Spring') {
        for (let m = 1; m <= 5; m++) semesterMonths.push(m);
      } else if (currentSem.semester === 'Fall') {
        for (let m = 8; m <= 12; m++) semesterMonths.push(m);
      }

      const eventsPromises = semesterMonths.map(monthNum =>
        getCalendarEvents(
          currentSem.academicYear,
          monthNum,
          currentSem.semester as 'Spring' | 'Fall',
          currentSem.academicYear
        ).catch(() => [])
      );

      const [strikesData, ...eventsDataArrays] = await Promise.all([
        getStudentsAtRisk().catch(() => ({ students: [], summary: { oneStrike: 0, blocked: 0 } })),
        ...eventsPromises,
      ]);

      setEvents(eventsDataArrays.flat());
      setStrikeStats({
        oneStrike: strikesData.summary?.oneStrike || 0,
        blocked: strikesData.summary?.blocked || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [viewingSemester]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getCalendarDays = (targetYear: number, targetMonth: number): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First day of the month
    const firstDay = new Date(targetYear, targetMonth, 1);
    const startingDay = firstDay.getDay();

    // Last day of the month
    const lastDay = new Date(targetYear, targetMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // Days from previous month
    const prevMonthLastDay = new Date(targetYear, targetMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = new Date(targetYear, targetMonth - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }

    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(targetYear, targetMonth, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }

    // Days from next month
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(targetYear, targetMonth + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }

    return days;
  };

  const getEventsForDate = (date: Date): Event[] => {
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  // Check if an event is administrative (Add/drop, Withdrawal, Registration, Ramadan, etc.)
  const isAdministrativeEvent = (event: Event): boolean => {
    const nameLower = event.name.toLowerCase();
    return (
      nameLower.includes('add/drop') ||
      nameLower.includes('withdrawal') ||
      nameLower.includes('registration') ||
      nameLower.includes('grading basis') ||
      nameLower.includes('final exams') ||
      nameLower.includes('last day of classes') ||
      nameLower === 'ramadan' ||
      nameLower.includes('ramadan/') ||
      nameLower.includes('ramadan /') ||
      nameLower === 'spring break' ||
      nameLower === 'eid break' ||
      nameLower === 'students depart' ||
      nameLower === 'no classes'
    );
  };

  // Generate months to display (only months within the current semester)
  const getMonthsToDisplay = () => {
    if (!semesterData) return [];
    
    const months: { year: number; month: number; name: string }[] = [];
    const semesterMonths: number[] = [];
    
    if (semesterData.semester === 'Spring') {
      for (let m = 1; m <= 5; m++) semesterMonths.push(m);
    } else if (semesterData.semester === 'Fall') {
      for (let m = 8; m <= 12; m++) semesterMonths.push(m);
    }
    
    semesterMonths.forEach(monthNum => {
      months.push({
        year: semesterData.academicYear,
        month: monthNum - 1,
        name: MONTHS[monthNum - 1],
      });
    });
    
    return months;
  };

  const monthsToDisplay = getMonthsToDisplay();

  if (loading) {
    return (
      <ProtectedRoute>
        <FullScreenLoading />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout>
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs sm:text-sm hover:text-[#57068c] hover:border-[#57068c]" 
            onClick={() => router.push('/events')}
          >
            List View
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="space-y-8">
              {error ? (
                <div className="text-center text-red-600 py-8">
                  <p>{error}</p>
                  <Button onClick={fetchEvents} className="mt-4">
                    Retry
                  </Button>
                </div>
              ) : (
                monthsToDisplay.map(({ year: monthYear, month: monthIndex, name: monthName }) => {
                  const calendarDays = getCalendarDays(monthYear, monthIndex);
                  return (
                    <Card key={`${monthYear}-${monthIndex}`}>
                      <CardHeader>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {monthName} {monthYear}
                        </h2>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          {/* Day headers */}
                          <div className="grid grid-cols-7 gap-1 mb-1">
                            {DAYS.map((day) => (
                              <div
                                key={day}
                                className="text-center text-xs font-medium text-gray-500 py-1.5"
                              >
                                {day}
                              </div>
                            ))}
                          </div>

                          {/* Calendar grid */}
                          <div className="grid grid-cols-7 gap-1 relative">
                            {calendarDays.map((day, index) => {
                              const dayEvents = getEventsForDate(day.date);
                              const isHovered = hoveredDate?.getTime() === day.date.getTime();
                              return (
                                <div
                                  key={index}
                                  className={`
                                    h-[92px] sm:h-[100px] md:h-[110px] bg-white border border-gray-100 rounded-lg p-1.5 sm:p-2 cursor-pointer transition-all relative overflow-hidden
                                    ${!day.isCurrentMonth ? 'opacity-40' : ''}
                                    ${day.isToday ? 'border-2 border-[#57068c] bg-[#57068c]/5' : ''}
                                    hover:border-[#57068c] hover:shadow-sm
                                  `}
                                  onMouseEnter={() => setHoveredDate(day.date)}
                                  onMouseLeave={() => setHoveredDate(null)}
                                >
                                  <div className={`
                                    text-xs sm:text-sm font-medium mb-0.5
                                    ${day.isToday ? 'text-[#57068c] font-semibold' : 'text-gray-700'}
                                  `}>
                                    {day.date.getDate()}
                                  </div>
                                  
                                  {/* Separate regular events from administrative events */}
                                  {(() => {
                                    const regularEvents = dayEvents.filter(e => !isAdministrativeEvent(e));
                                    const adminEvents = dayEvents.filter(e => isAdministrativeEvent(e));
                                    
                                    return (
                                      <>
                                        {/* Event names for regular events */}
                                        {regularEvents.length > 0 && (
                                          <div className="mt-1 space-y-0.5">
                                            {regularEvents.slice(0, 3).map((event, idx) => (
                                              <Link
                                                key={event.id || idx}
                                                href={`/events/${event.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="block text-[9px] leading-tight text-[#57068c] font-medium truncate px-0.5 py-0.5 bg-[#57068c]/10 rounded hover:bg-[#57068c]/20 transition-colors"
                                                title={event.name}
                                              >
                                                {event.name.length > 18 ? event.name.substring(0, 18) + '…' : event.name}
                                              </Link>
                                            ))}
                                            {regularEvents.length > 3 && (
                                              <div className="text-[8px] text-[#57068c]/80 font-medium">
                                                +{regularEvents.length - 3} more
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* Small text indicators for administrative events */}
                                        {adminEvents.length > 0 && (
                                          <div className="mt-1 space-y-0.5">
                                            {adminEvents.slice(0, 2).map((event, idx) => (
                                              <div
                                                key={event.id || idx}
                                                className="text-[8px] leading-tight text-gray-600 truncate px-0.5 py-0.5 bg-gray-50 rounded"
                                                title={event.name}
                                              >
                                                {event.name.length > 20 ? event.name.substring(0, 20) + '...' : event.name}
                                              </div>
                                            ))}
                                            {adminEvents.length > 2 && (
                                              <div className="text-[8px] text-gray-500">
                                                +{adminEvents.length - 2} more
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {/* Hover tooltip */}
                                  {isHovered && (
                                    <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2">
                                      <div className="text-xs font-semibold text-gray-700 mb-2">
                                        {day.date.toLocaleDateString('en-US', {
                                          weekday: 'long',
                                          month: 'long',
                                          day: 'numeric',
                                        })}
                                      </div>
                                      {dayEvents.length === 0 ? (
                                        <div className="text-xs text-gray-500">No events today</div>
                                      ) : (
                                        <div className="space-y-1">
                                          {dayEvents.map((event) => {
                                            const isAdmin = isAdministrativeEvent(event);
                                            return (
                                              <div 
                                                key={event.id} 
                                                className={`text-xs ${
                                                  isAdmin 
                                                    ? 'text-gray-600 italic' 
                                                    : 'text-gray-900 font-medium'
                                                }`}
                                              >
                                                {event.name}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {/* Tooltip arrow */}
                                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Month Summaries */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {monthsToDisplay.map(({ year: monthYear, month: monthIndex, name: monthName }) => {
                const monthEvents = events.filter((event) => {
                  const eventDate = new Date(event.startDate);
                  return eventDate.getFullYear() === monthYear && eventDate.getMonth() === monthIndex;
                });
                
                return (
                  <Card key={`${monthYear}-${monthIndex}`}>
                    <CardHeader>
                      <CardTitle>{monthName} {monthYear}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                          <span className="text-gray-600">Total Events</span>
                          <span className="font-semibold text-gray-900">{monthEvents.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Strikes:</span>
                          <span className="font-semibold text-gray-900">{strikeStats.oneStrike}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}

