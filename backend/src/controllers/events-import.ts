import { Request, Response } from 'express';
import { Event, AttendanceMode } from '../models/Event';
import { sendSuccess, sendError } from '../utils/response';
import multer from 'multer';
import { getDefaultGeoLeadFallback, resolveCalendarCsvTeamLeaders } from '../utils/geo-lead-organizer';

// Configure multer for CSV uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export const importCSVMiddleware = csvUpload.single('csv');

interface ParsedEvent {
  name: string;
  date: Date;
  notes?: string;
  leadOrganizer?: string;
  staffAtEvent?: string;
}

// Parse the calendar CSV format
function parseCalendarCSV(csvContent: string, year: number): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = csvContent.split('\n');
  
  let currentWeekDates: string[] = [];
  let currentProgramming: string[] = [];
  let currentNotes: string[] = [];
  let currentLeadOrganizer: string[] = [];
  let currentStaff: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(',').map(c => c.trim());
    
    // Check for month headers
    if (cells[0] && ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].includes(cells[0])) {
      continue;
    }
    
    // Parse date row
    if (cells[0] === 'Date') {
      // Process previous week's data first
      processWeekData(events, currentWeekDates, currentProgramming, currentNotes, currentLeadOrganizer, currentStaff, year);
      
      // Reset for new week
      currentWeekDates = cells.slice(1).filter(c => c);
      currentProgramming = [];
      currentNotes = [];
      currentLeadOrganizer = [];
      currentStaff = [];
      continue;
    }
    
    // Parse programming row
    if (cells[0] === 'Programming') {
      currentProgramming = cells.slice(1);
      continue;
    }
    
    // Parse notes row
    if (cells[0] === 'Notes') {
      currentNotes = cells.slice(1);
      continue;
    }
    
    // Parse lead organizer row
    if (cells[0] === 'Lead Organizer' || cells[0] === 'Lead') {
      currentLeadOrganizer = cells.slice(1);
      continue;
    }
    
    // Parse staff row
    if (cells[0] === 'Staff at Event' || cells[0] === 'Staff') {
      currentStaff = cells.slice(1);
      continue;
    }
    
    // Check for programming in unlabeled rows (some rows have event data without 'Programming' label)
    if (cells[0] === '' && cells.slice(1).some(c => c && c.length > 0)) {
      // This might be programming data in an unlabeled row
      const hasEventData = cells.slice(1).some(c => c && !c.includes('Ramadan') && c.length > 5);
      if (hasEventData) {
        currentProgramming = cells.slice(1);
      }
    }
  }
  
  // Process the last week
  processWeekData(events, currentWeekDates, currentProgramming, currentNotes, currentLeadOrganizer, currentStaff, year);
  
  return events;
}

function processWeekData(
  events: ParsedEvent[],
  dates: string[],
  programming: string[],
  notes: string[],
  leadOrganizer: string[],
  staff: string[],
  year: number
): void {
  for (let i = 0; i < dates.length && i < 7; i++) {
    const dateStr = dates[i];
    const eventName = programming[i] || '';
    const eventNotes = notes[i] || '';
    const eventLead = leadOrganizer[i] || '';
    const eventStaff = staff[i] || '';
    
    // Skip empty events or just date markers
    if (!eventName || eventName.length < 3) continue;
    
    // Skip pure Ramadan markers (they're not actual events)
    if (eventName === 'Ramadan' || eventName === 'Ramadan/Eid Break' || eventName === 'Spring Break') continue;
    
    // Parse date (format: "Jan-1", "Feb-15", etc.)
    const date = parseDateString(dateStr, year);
    if (!date) continue;
    
    events.push({
      name: eventName,
      date,
      notes: eventNotes || undefined,
      leadOrganizer: eventLead || undefined,
      staffAtEvent: eventStaff || undefined,
    });
  }
}

function parseDateString(dateStr: string, year: number): Date | null {
  if (!dateStr) return null;
  
  // Parse format like "Jan-1", "Feb-15"
  const match = dateStr.match(/^([A-Za-z]+)-(\d+)$/);
  if (!match) return null;
  
  const monthStr = match[1];
  const day = parseInt(match[2], 10);
  
  const months: { [key: string]: number } = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const month = months[monthStr];
  if (month === undefined || isNaN(day)) return null;
  
  return new Date(year, month, day);
}

// Import events from calendar CSV
export const importEventsFromCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No CSV file uploaded', 400);
      return;
    }

    const year = req.body.year ? parseInt(req.body.year, 10) : new Date().getFullYear();

    const fallbackGeo = await getDefaultGeoLeadFallback();
    if (!fallbackGeo) {
      sendError(res, 'No GEO staff found to assign as lead organizer. Add GEO staff first.', 400);
      return;
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8');
    const parsedEvents = parseCalendarCSV(csvContent, year);

    const results = {
      total: parsedEvents.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      events: [] as any[],
    };

    // Process each event
    for (const parsed of parsedEvents) {
      try {
        const startDateIso = parsed.date instanceof Date ? parsed.date.toISOString() : String(parsed.date);

        // Check if event already exists (same name and date)
        const existingEvent = await Event.findOne({
          where: {
            name: parsed.name,
            startDate: parsed.date,
          },
        });

        // Bus-based is the only supported attendance mode.
        const attendanceMode = AttendanceMode.BUS_BASED;

        const leads = await resolveCalendarCsvTeamLeaders(parsed.leadOrganizer, fallbackGeo);

        if (existingEvent) {
          // Update existing event (including leads when CSV specifies them)
          await existingEvent.update({
            notes: parsed.notes,
            attendanceMode,
            leadOrganizerId: leads.leadOrganizerId,
            leadOrganizer2Id: leads.leadOrganizer2Id,
            leadOrganizer3Id: leads.leadOrganizer3Id,
          });
          results.updated++;
          results.events.push({
            name: parsed.name,
            date: startDateIso,
            status: 'updated',
          });
        } else {
          // Create new event
          await Event.create({
            name: parsed.name,
            startDate: parsed.date,
            notes: parsed.notes,
            leadOrganizerId: leads.leadOrganizerId,
            leadOrganizer2Id: leads.leadOrganizer2Id,
            leadOrganizer3Id: leads.leadOrganizer3Id,
            attendanceMode,
            isLocked: false,
          });
          results.created++;
          results.events.push({
            name: parsed.name,
            date: startDateIso,
            status: 'created',
          });
        }
      } catch (error: any) {
        results.skipped++;
        results.errors.push(`Error processing "${parsed.name}": ${error.message}`);
      }
    }

    sendSuccess(res, results, 200, 'Event import completed');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to import events', 500);
  }
};


