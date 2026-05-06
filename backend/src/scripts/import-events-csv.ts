import { sequelize } from '../database/connection';
import { Event, AttendanceMode } from '../models/Event';
import { getDefaultGeoLeadFallback, resolveCalendarCsvTeamLeaders } from '../utils/geo-lead-organizer';
import * as fs from 'fs';
import * as path from 'path';

interface ParsedEvent {
  name: string;
  date: Date;
  notes?: string;
  leadOrganizer?: string;
  staffAtEvent?: string;
  isAdministrative?: boolean; // Flag for administrative dates (Add/drop, Withdrawal, etc.)
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
  const administrativeEvents: ParsedEvent[] = []; // Store administrative events separately
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Handle CSV parsing more carefully - split by comma but preserve quoted strings
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentCell += char;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim()); // Add last cell
    
    // Check for month headers (skip them)
    if (cells[0] && ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].includes(cells[0])) {
      continue;
    }
    
    // Parse date row
    if (cells[0] === 'Date') {
      // Process previous week's data first
      processWeekData(events, currentWeekDates, currentProgramming, currentNotes, currentLeadOrganizer, currentStaff, year);
      
      // Reset for new week
      currentWeekDates = cells.slice(1).filter(c => c && c.length > 0);
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
    // This handles rows like line 28, 86, 94, 108, 142, 155
    if (cells[0] === '' && cells.slice(1).some(c => c && c.trim().length > 0)) {
      // Check if this looks like event data (not just dates or empty)
      const hasEventData = cells.slice(1).some(c => {
        if (!c || c.trim().length < 3) return false;
        const trimmed = c.trim();
        // Skip if it's just a date format or common non-event text
        if (trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d+$/)) return false;
        if (trimmed === 'Ramadan' || trimmed === 'Spring Break' || trimmed === 'Eid Break' || trimmed === 'Final exams' || trimmed === 'Students Depart' || trimmed === 'No Classes') return false;
        // Skip day names
        if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(trimmed)) return false;
        // Skip if it looks like a staff list (comma-separated names)
        if (trimmed.match(/^[A-Z][a-z]+,\s*[A-Z]/)) return false;
        return true;
      });
      
      if (hasEventData) {
        // This might be programming data in an unlabeled row
        // Check if we have dates to match
        if (currentWeekDates.length > 0) {
          // Merge with existing programming if any, prioritizing this row if it has longer text
          const mergedProgramming = [...currentProgramming];
          cells.slice(1).forEach((cell, idx) => {
            const trimmed = cell ? cell.trim() : '';
            if (trimmed && trimmed.length > 3 && 
                !trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d+$/) && 
                !['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(trimmed) &&
                !trimmed.match(/^[A-Z][a-z]+,\s*[A-Z]/)) { // Not a staff list
              if (idx < mergedProgramming.length) {
                const existing = mergedProgramming[idx] ? mergedProgramming[idx].trim() : '';
                // Replace if empty or if new text is longer (likely more complete)
                if (!existing || existing.length < trimmed.length) {
                  mergedProgramming[idx] = trimmed;
                }
              } else {
                // Extend array if needed
                while (mergedProgramming.length <= idx) {
                  mergedProgramming.push('');
                }
                mergedProgramming[idx] = trimmed;
              }
            }
          });
          currentProgramming = mergedProgramming;
        }
      }
    }
    
    // Also check Notes row for events that might be listed there instead of Programming
    // This handles cases like "Ghabga (on campus)", "Teamlabs + Iftar", "Abaya/ Kandura Shopping", "Qasr Al Watan"
    // Also extract administrative dates (Add/drop, Withdrawal, Registration, etc.)
    if (cells[0] === 'Notes') {
      const notesCells = cells.slice(1);
      notesCells.forEach((note, idx) => {
        if (!note || idx >= currentWeekDates.length) return;
        
        const trimmed = note.trim();
        const isAdministrative = trimmed.includes('Add/drop') || 
                                 trimmed.includes('Withdrawal') || 
                                 trimmed.includes('Registration') ||
                                 trimmed.includes('Grading basis') ||
                                 trimmed.includes('Final exams') ||
                                 trimmed.includes('Last day of classes');
        
        if (isAdministrative && trimmed.length > 5) {
          // This is an administrative date - store it separately
          const dateStr = currentWeekDates[idx];
          const date = parseDateString(dateStr, year);
          if (date) {
            administrativeEvents.push({
              name: trimmed,
              date,
              isAdministrative: true,
            });
          }
        } else if (trimmed.length > 5 && 
            !trimmed.match(/^[A-Z][a-z]+,\s*[A-Z]/) && // Not a name list like "Name, Name"
            !trimmed.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+,\s*[A-Z]/)) { // Not "FirstName LastName, Name"
          // This might be an event in the notes
          if (idx < currentProgramming.length) {
            // Only replace if programming cell is empty or shorter
            if (!currentProgramming[idx] || currentProgramming[idx].trim().length < trimmed.length) {
              currentProgramming[idx] = trimmed;
            }
          } else {
            // Extend programming array if needed
            while (currentProgramming.length <= idx) {
              currentProgramming.push('');
            }
            currentProgramming[idx] = trimmed;
          }
        }
      });
    }
  }
  
  // Process the last week
  processWeekData(events, currentWeekDates, currentProgramming, currentNotes, currentLeadOrganizer, currentStaff, year);
  
  // Add administrative events to the main events array
  events.push(...administrativeEvents);
  
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
    let eventName = programming[i] || '';
    
    // If no event name in programming, check notes (some events are only in notes)
    if (!eventName || eventName.length < 3) {
      const noteText = notes[i] || '';
      // Check if note contains event-like text (not just staff names or administrative notes)
      if (noteText && noteText.length > 10 && !noteText.includes('Add/drop') && !noteText.includes('Withdrawal') && !noteText.includes('Registration') && !noteText.includes('Grading basis')) {
        // This might be an event description
        eventName = noteText;
      }
    }
    
    const eventNotes = notes[i] || '';
    const eventLead = leadOrganizer[i] || '';
    const eventStaff = staff[i] || '';
    
    // Skip empty events
    if (!eventName || eventName.trim().length < 3) continue;
    
    // Skip day names
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (dayNames.includes(eventName.toLowerCase().trim())) continue;
    
    // Parse date (format: "Jan-1", "Feb-15", etc.)
    const date = parseDateString(dateStr, year);
    if (!date) continue;
    
    // Check if this is an administrative/marker event (Ramadan, etc.)
    const nameLower = eventName.toLowerCase().trim();
    const isAdministrativeMarker = 
      nameLower === 'ramadan' || 
      nameLower === 'ramadan/eid break' || 
      nameLower === 'spring break' ||
      nameLower === 'eid break' ||
      nameLower === 'final exams' ||
      nameLower === 'students depart' ||
      nameLower === 'no classes' ||
      nameLower.startsWith('ramadan/') ||
      nameLower === 'ramadan/ lunar new year' ||
      nameLower === 'ramadan/ no classes';
    
    // If it's an administrative marker, add it as an administrative event
    if (isAdministrativeMarker) {
      events.push({
        name: eventName,
        date,
        isAdministrative: true,
      });
      continue; // Don't process as regular event
    }
    
    // Clean up event name
    eventName = eventName.trim();
    
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

async function importEventsFromCSV(csvPath: string, year: number = 2026) {
  try {
    console.log('🔄 Starting event import from CSV...');
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const parsedEvents = parseCalendarCSV(csvContent, year);

    console.log(`📊 Found ${parsedEvents.length} events in CSV`);

    const fallbackGeo = await getDefaultGeoLeadFallback();
    if (!fallbackGeo) {
      console.error('❌ No GEO staff found. Add at least one GEO (staff) before importing events.');
      process.exit(1);
    }

    const results = {
      total: parsedEvents.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each event
    for (const parsed of parsedEvents) {
      try {
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
          // Update existing event
          await existingEvent.update({
            notes: parsed.notes,
            attendanceMode,
            leadOrganizerId: leads.leadOrganizerId,
            leadOrganizer2Id: leads.leadOrganizer2Id,
            leadOrganizer3Id: leads.leadOrganizer3Id,
          });
          results.updated++;
          console.log(`✅ Updated: ${parsed.name} on ${parsed.date.toLocaleDateString()}`);
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
          console.log(`✅ Created: ${parsed.name} on ${parsed.date.toLocaleDateString()}`);
        }
      } catch (error: any) {
        results.skipped++;
        results.errors.push(`Error processing "${parsed.name}": ${error.message}`);
        console.error(`❌ Error processing "${parsed.name}": ${error.message}`);
      }
    }

    console.log('\n✅ Import completed!');
    console.log(`📊 Results:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Created: ${results.created}`);
    console.log(`   - Updated: ${results.updated}`);
    console.log(`   - Skipped: ${results.skipped}`);
    if (results.errors.length > 0) {
      console.log(`   - Errors: ${results.errors.length}`);
      results.errors.forEach(err => console.log(`     ${err}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing events:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  const csvPath = process.argv[2];
  const year = process.argv[3] ? parseInt(process.argv[3], 10) : 2026;
  
  if (!csvPath) {
    console.error('❌ Please provide CSV file path');
    console.log('Usage: npx ts-node src/scripts/import-events-csv.ts <path-to-csv> [year]');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  importEventsFromCSV(fullPath, year);
}

export default importEventsFromCSV;
