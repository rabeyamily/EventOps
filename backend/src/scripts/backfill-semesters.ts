import { Event } from '../models/Event';
import { getSemesterFromDate } from '../utils/semester';

/**
 * Backfill script to add semester and academicYear to existing events
 * Run this once after adding the semester fields to the Event model
 */
async function backfillSemesters() {
  try {
    console.log('🔄 Starting semester backfill...');
    
    // Get all events without semester
    const { Op } = await import('sequelize');
    const events = await Event.findAll({
      where: {
        semester: { [Op.is]: null },
      } as any,
    });

    console.log(`📊 Found ${events.length} events to update`);

    let updated = 0;
    for (const event of events) {
      const { semester, academicYear } = getSemesterFromDate(event.startDate);
      await event.update({ semester, academicYear });
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`✅ Updated ${updated}/${events.length} events...`);
      }
    }

    console.log(`✅ Successfully updated ${updated} events with semester information`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error backfilling semesters:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backfillSemesters();
}

export { backfillSemesters };
