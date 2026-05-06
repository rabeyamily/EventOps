import { sequelize } from '../database/connection';
import { Student } from '../models/Student';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Update students from CSV file
 * Matches by email and updates:
 * - Preferred names
 * - Cohort information (based on New/Returning status and Previous Semester)
 * 
 * Usage: npx ts-node src/scripts/update-students-from-csv.ts <path-to-csv>
 */
async function updateStudentsFromCSV(csvPath: string, currentCohortOverride?: string) {
  try {
    console.log('🔄 Starting student update from CSV...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records: any[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
      bom: true,
    });

    console.log(`📊 Found ${records.length} records in CSV`);

    const results = {
      total: records.length,
      updated: 0,
      notFound: 0,
      errors: [] as string[],
    };

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        // Skip rows without email
        if (!row || !row.Email) {
          results.errors.push(`Row ${i + 2}: Skipped - Missing email`);
          continue;
        }

        const email = row.Email.trim().toLowerCase();
        
        // Find student by email
        const student = await Student.findOne({
          where: { nyuEmail: email },
        });

        if (!student) {
          results.notFound++;
          results.errors.push(`Row ${i + 2}: Student not found - ${email}`);
          continue;
        }

        // Prepare update data
        const updateData: any = {};

        // Update preferred name
        if (row.Preferred && row.Preferred.trim()) {
          updateData.preferredName = row.Preferred.trim();
        }

        // Update cohort information based on New/Returning status
        const newOrReturning = row['New / Returning']?.trim();
        const previousSemester = row['Previous Semester']?.trim();
        const currentCohort = currentCohortOverride || (() => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          return month >= 8 && month <= 12 ? `Fall ${year}` : `Spring ${year}`;
        })();

        if (newOrReturning) {
          if (newOrReturning.toLowerCase() === 'new') {
            // New student: only has Spring 2026 cohort
            // If the student's current cohort doesn't match, we need to update it
            if (student.cohort !== currentCohort && !student.cohort?.includes(currentCohort)) {
              updateData.cohort = currentCohort;
              updateData.primaryCohort = currentCohort;
            }
          } else if (newOrReturning.toLowerCase() === 'returning') {
            // Returning student: add previous semester to cohort list
            let cohortList: string[] = [];
            
            // Get existing cohorts from the current cohort field
            if (student.cohort) {
              cohortList = student.cohort.split(',').map(c => c.trim()).filter(c => c);
            }
            
            // Ensure current cohort is in the list
            if (!cohortList.includes(currentCohort)) {
              cohortList.push(currentCohort);
            }
            
            // Add previous semester if provided and not already present
            if (previousSemester && previousSemester !== 'NA' && previousSemester !== '' && previousSemester.trim() !== '') {
              const prevSem = previousSemester.trim();
              if (!cohortList.includes(prevSem)) {
                cohortList.push(prevSem);
              }
            }
            
            // Sort cohorts (most recent first) and update
            // Spring 2026 should be first (primary)
            const sortedCohorts = [currentCohort, ...cohortList.filter(c => c !== currentCohort)];
            updateData.cohort = sortedCohorts.join(', ');
            updateData.primaryCohort = currentCohort; // Most recent is Spring 2026
          }
        }

        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          await student.update(updateData);
          results.updated++;
          console.log(`✅ Updated: ${student.fullName} (${email})`);
        } else {
          console.log(`ℹ️  No changes needed: ${student.fullName} (${email})`);
        }
      } catch (error: any) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
        console.error(`❌ Error processing row ${i + 2}:`, error.message);
      }
    }

    console.log('\n✅ Update completed!');
    console.log(`📊 Results:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Updated: ${results.updated}`);
    console.log(`   - Not Found: ${results.notFound}`);
    if (results.errors.length > 0) {
      console.log(`\n⚠️  Errors/Warnings (${results.errors.length}):`);
      results.errors.slice(0, 20).forEach(err => console.log(`   - ${err}`));
      if (results.errors.length > 20) {
        console.log(`   ... and ${results.errors.length - 20} more`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating students:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  const csvPath = process.argv[2] || 'work1.csv';
  const cohortArg = process.argv[3]; // optional: e.g. "Spring 2026"
  
  // Try to find the file
  let fullPath: string;
  if (path.isAbsolute(csvPath)) {
    fullPath = csvPath;
  } else {
    // Try relative to current directory, then try project root
    fullPath = fs.existsSync(csvPath) 
      ? path.resolve(csvPath)
      : path.join(process.cwd(), '..', '..', csvPath);
  }
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    console.log('Usage: npx ts-node src/scripts/update-students-from-csv.ts <path-to-csv> [cohort]');
    console.log('Example: npx ts-node src/scripts/update-students-from-csv.ts students.csv "Fall 2026"');
    process.exit(1);
  }
  
  updateStudentsFromCSV(fullPath, cohortArg);
}

export default updateStudentsFromCSV;
