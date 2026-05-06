import { sequelize } from '../database/connection';
import { Student } from '../models/Student';
import { SystemSettings } from '../models/SystemSettings';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Import students from CSV file
 * Usage: npx ts-node src/scripts/import-students-csv.ts <path-to-csv>
 */
async function importStudentsCSV(csvPath: string) {
  try {
    console.log('🔄 Starting CSV import...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Get current semester from system settings, fall back to date-derived value
    const now = new Date();
    const nowMonth = now.getMonth() + 1;
    const nowYear = now.getFullYear();
    let cohort = nowMonth >= 8 && nowMonth <= 12
      ? `Fall ${nowYear}`
      : `Spring ${nowYear}`;
    try {
      const semesterSetting = await SystemSettings.findOne({ 
        where: { key: 'current_semester' } 
      });
      if (semesterSetting && semesterSetting.value) {
        cohort = semesterSetting.value;
        console.log(`📅 Using current semester: ${cohort}`);
      } else {
        console.log(`📅 No setting found, using auto-detected: ${cohort}`);
      }
    } catch (err) {
      console.error('Failed to fetch current semester, using date-derived value:', err);
    }

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
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        // Skip rows without essential data
        if (!row || !row.Email || !row.First || !row.Last) {
          results.skipped++;
          results.errors.push(`Row ${i + 2}: Skipped - Missing required fields`);
          continue;
        }

        // Validate email format
        if (!row.Email.includes('@') || !row.Email.includes('.')) {
          results.skipped++;
          results.errors.push(`Row ${i + 2}: Skipped - Invalid email: ${row.Email}`);
          continue;
        }

        // Determine campus
        const { Campus } = await import('../models/Student');
        let campus: any = Campus.NYC;
        const schoolField = row.School || '';
        if (schoolField.toLowerCase().includes('shanghai')) {
          campus = Campus.SHANGHAI;
        }

        // Build full name
        const fullName = `${row.First} ${row.Last}`.trim();
        const preferredName = row.Preferred && row.Preferred !== row.First ? row.Preferred : undefined;

        // Build emergency contact
        let emergencyContact: string | undefined;
        if (row['Emergency Contact Name']) {
          const parts = [row['Emergency Contact Name']];
          if (row['Emergency Contact Type']) {
            parts.unshift(`[${row['Emergency Contact Type']}]`);
          }
          if (row['Emergency Contact Phone'] && row['Emergency Contact Phone'] !== '#ERROR!') {
            parts.push(`Phone: ${row['Emergency Contact Phone']}`);
          }
          if (row['Emergency Contact Email']) {
            parts.push(`Email: ${row['Emergency Contact Email']}`);
          }
          emergencyContact = parts.join(' | ');
        }

        // Parse other fields
        const gpa = row.GPA ? parseFloat(row.GPA) : undefined;
        let birthdate: Date | undefined = undefined;
        if (row.Birthdate) {
          const parsedDate = new Date(row.Birthdate);
          if (!isNaN(parsedDate.getTime())) {
            birthdate = parsedDate;
          }
        }
        const gender = row['Gender Identity'] || row['Legal Sex'] || undefined;
        
        // Clean address
        let address = row.Address;
        if (address) {
          address = address.replace(/\s+/g, ' ').trim();
        }

        // Check if student exists
        const existingStudent = await Student.findOne({
          where: { 
            nyuEmail: row.Email,
          },
        });

        if (existingStudent) {
          // Student exists - update and add cohort if not present
          const existingCohorts = existingStudent.cohort ? existingStudent.cohort.split(',').map(c => c.trim()) : [];
          
          if (!existingCohorts.includes(cohort)) {
            existingCohorts.push(cohort);
          }
          
          await existingStudent.update({
            fullName,
            preferredName,
            campus,
            emergencyContact,
            gpa,
            birthdate,
            gender,
            address,
            cohort: existingCohorts.join(', '),
            primaryCohort: cohort,
            // Preserve strikeCount and status
            strikeCount: existingStudent.strikeCount,
            status: existingStudent.status,
          });
          results.updated++;
        } else {
          // Create new student
          await Student.create({
            fullName,
            preferredName,
            nyuEmail: row.Email,
            nNumber: row['N Number'] || undefined,
            campus,
            emergencyContact,
            cohort: cohort,
            primaryCohort: cohort,
            school: row.School || undefined,
            major: row.Major || undefined,
            academicLevel: row['Academic Level'] || undefined,
            gpa,
            admitTerm: row['Admit Term at NYU AD'] || undefined,
            birthdate,
            citizenship: row['Primary Passport Country (Country of Citizenship)'] || undefined,
            passportCountry: row['Primary Passport Country (Country of Citizenship)'] || undefined,
            gender,
            address,
            strikeCount: 0,
            status: 'clear' as any,
          });
          results.created++;
        }
      } catch (error: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    console.log('\n✅ Import completed!');
    console.log(`📊 Results:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Created: ${results.created}`);
    console.log(`   - Updated: ${results.updated}`);
    console.log(`   - Skipped: ${results.skipped}`);
    if (results.errors.length > 0) {
      console.log(`\n⚠️  Errors (${results.errors.length}):`);
      results.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (results.errors.length > 10) {
        console.log(`   ... and ${results.errors.length - 10} more errors`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing CSV:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('❌ Please provide CSV file path');
    console.log('Usage: npx ts-node src/scripts/import-students-csv.ts <path-to-csv>');
    process.exit(1);
  }
  
  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }
  
  importStudentsCSV(fullPath);
}

export default importStudentsCSV;
