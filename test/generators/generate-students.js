/**
 * Generates student roster CSVs for 4 semesters (100-120 students each).
 * Up to 10 students may be shared between any two semesters.
 * All data is randomly generated — no real personal info.
 *
 * Output: test/students/students_{semester}.csv
 * Run:    node test/generators/generate-students.js
 */

const fs   = require('fs');
const path = require('path');

// ── name pools ────────────────────────────────────────────────────────────────
const FIRST = [
  'Aaliyah','Aaqil','Aicha','Aida','Aissatou','Ajok','Amara','Amina','Ananya','Arjun',
  'Ava','Basma','Beatrice','Benjamin','Bilal','Carlos','Carmen','Chen','Chiara','Dalia',
  'Daniel','David','Diana','Elena','Emeka','Emmanuel','Esther','Farah','Fatima','Gabriel',
  'Grace','Hana','Hassan','Ibrahim','Ines','Isha','Jamal','Jasmine','Javier','Kai',
  'Kara','Karim','Kenji','Kwame','Laila','Liam','Lily','Luis','Luna','Malika',
  'Marco','Maria','Maya','Mei','Milan','Mohamed','Mona','Nadira','Nala','Omar',
  'Olga','Oscar','Paloma','Priya','Qadir','Rania','Rafael','Riya','Rosa','Samir',
  'Sara','Santiago','Selin','Sienna','Sofia','Soren','Tanya','Tariq','Thiago','Uma',
  'Victor','Vivian','Wei','Xavier','Yara','Yasmin','Yuki','Zara','Zina','Adele',
  'Boris','Camille','Dmitri','Eloise','Finn','Gemma','Hugo','Ivy','Jules','Kian',
  'Leila','Mateo','Nadia','Otis','Petra','Quinn','Remi','Sage','Teo','Ursula',
  'Vera','Wren','Xena','Yosef','Zane','Anya','Bryce','Clara','Drake','Freya',
];
const LAST = [
  'Okafor','Diallo','Sharma','Patel','Chen','Rodriguez','Kim','Nakamura','Santos','Bergstrom',
  'Petrov','Kone','Osei','Mbeki','Torres','Fernandez','Gupta','Lee','Tanaka','Dubois',
  'Moreau','Hassan','Okonkwo','Yamazaki','Cardoso','Reyes','Andersen','Novak','Volkov','Ortiz',
  'Nkomo','Bianchi','Fischer','Kumar','Ng','Park','Singh','Takahashi','Vargas','Yilmaz',
  'Abara','Benali','Cho','Dlamini','Eriksson','Fontaine','Garcia','Haddad','Ivanov','Johansson',
  'Kamara','Larsson','Muller','Nazari','Otieno','Pavlov','Quiroga','Rossi','Schmidt','Traore',
  'Ueda','Visser','Weber','Xiao','Yamamoto','Zhao','Adjei','Bello','Cruz','Doyle',
  'Mensah','Bourne','Kowalski','Ferreira','Lindqvist','Marchetti','Hassanein','Mansouri','Brandt','Sayed',
];
const PREFERRED = ['Alex','Sam','Max','Jo','Lou','Pat','Ash','Jay','Kai','Lee','Noel','Sky','Ari','Rio','Eli','Nico','Sage','Val'];
const SCHOOLS   = [
  'NYU College of Arts and Science','NYU Tandon School of Engineering',
  'NYU Stern School of Business','NYU Gallatin School of Individualized Study',
  'NYU Tisch School of the Arts','NYU Liberal Studies','NYU Steinhardt',
  'NYU Shanghai','NYU School of Professional Studies',
];
const MAJORS = [
  'Computer Science','Economics','Political Science','Biology','Psychology','Mathematics',
  'Business Administration','Film & Television','Philosophy','History','Electrical Engineering',
  'Data Science','Sociology','Chemistry','English Literature','Interactive Media Arts',
  'Finance','Marketing','Public Health','International Relations','Environmental Studies',
  'Journalism','Music','Theatre','Mechanical Engineering',
];
const LEVELS    = ['Freshman','Sophomore','Junior','Senior'];
const GENDERS   = ['Male','Female','Non-Binary','Prefer not to say'];
const SEXES     = ['Male','Female'];
const COUNTRIES = [
  'United States','China','India','Nigeria','South Korea','Japan','Brazil','Germany',
  'France','United Kingdom','Mexico','Ghana','Kenya','Egypt','Canada','Australia',
  'Saudi Arabia','Turkey','Indonesia','Pakistan','Morocco','Senegal','Colombia','Italy',
  'Sweden','Russia','Argentina','Thailand','Vietnam','Philippines','South Africa','UAE',
];
const CITIES = [
  'New York','Los Angeles','Chicago','London','Paris','Tokyo','Shanghai','Mumbai',
  'Lagos','Cairo','Berlin','Sao Paulo','Mexico City','Seoul','Dubai','Toronto',
  'Sydney','Istanbul','Bangkok','Nairobi','Accra','Dakar','Bogota','Houston',
];
const RELIGIONS   = ['Christianity','Islam','Hinduism','Buddhism','Judaism','None','Other','Sikhism'];
const LANGUAGES   = ['English','Spanish','French','Mandarin','Arabic','Hindi','Swahili','Portuguese','Japanese','Korean','German','Russian','Turkish'];
const MARITAL     = ['Single','Married','Domestic Partnership'];
const INSURANCE   = ['Geoblue','Cigna','Aetna','UnitedHealthcare','Blue Cross Blue Shield'];
const EC_TYPES    = ['Parent','Guardian','Sibling','Spouse','Friend','Other'];
const STATES      = ['NY','CA','TX','IL','FL','MA','PA','OH','NJ','VA','CT','',''];
const STREETS     = ['Main St','Oak Ave','Elm Blvd','University Place','Washington Square','Broadway','5th Ave','Park Ave','Bleecker St','Lafayette St'];

const SEMESTERS = [
  { key: 'spring_2025', label: 'Spring 2025' },
  { key: 'fall_2025',   label: 'Fall 2025'   },
  { key: 'spring_2026', label: 'Spring 2026' },
  { key: 'fall_2026',   label: 'Fall 2026'   },
];

const outDir = path.join(__dirname, '..', 'students');

// ── helpers ────────────────────────────────────────────────────────────────────
function rand(arr)         { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n, l)         { return String(n).padStart(l, '0'); }

function genEmail(first, last) {
  return `${first[0].toLowerCase()}${last[0].toLowerCase()}${randInt(100,99999)}@nyu.edu`;
}
function genPhone() {
  return `+${randInt(1,99)}-${randInt(100,999)}-${randInt(100,999)}-${randInt(1000,9999)}`;
}
function genDate(y1, y2) {
  return `${pad(randInt(1,28),2)}/${pad(randInt(1,12),2)}/${randInt(y1,y2)}`;
}
function genPassport(prefix) {
  return `${prefix}${randInt(10000000,99999999)}`;
}
function escapeCsv(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
}

function generateStudent() {
  const first   = rand(FIRST);
  const last    = rand(LAST);
  const preferred = Math.random() < 0.3 ? rand(PREFERRED) : '';
  const email   = genEmail(first, last);
  const school  = rand(SCHOOLS);
  const country = rand(COUNTRIES);
  const secPassport = Math.random() < 0.15;
  const ecFirst = rand(FIRST);
  const altFirst = rand(FIRST);

  return {
    Last:  last,
    First: first,
    Preferred: preferred,
    'N Number': `N${randInt(10000000,99999999)}`,
    Email: email,
    'Date Approved': genDate(2024,2025),
    'Application Status': 'Approved',
    'Admit Term at NYU AD': '',        // set per-semester later
    'Accepted Program': `${school} - ${rand(MAJORS)}`,
    School: school,
    Major:  rand(MAJORS),
    'Academic Level': rand(LEVELS),
    GPA: (Math.random() * 1.5 + 2.5).toFixed(2),
    'Passport Upload': 'Yes',
    'Immigration Form': 'Complete',
    'Primary Passport Last Name':  last,
    'Primary Passport First Name': first,
    'Primary Passport Country (Country of Citizenship)': country,
    'Primary Passport Issuing Authority': country,
    'Primary Passport Number': genPassport('P'),
    'Primary Passport Validity Date':    genDate(2020,2023),
    'Primary Passport Expiration Date':  genDate(2027,2032),
    'Sex in Passport':  rand(SEXES),
    'Legal Sex':        rand(SEXES),
    'Country of Previous Nationality': Math.random() < 0.1 ? rand(COUNTRIES) : '',
    'Languages Spoken': [rand(LANGUAGES), rand(LANGUAGES)].filter((v,i,a)=>a.indexOf(v)===i).join(', '),
    Religion: rand(RELIGIONS),
    'Religious Sect': '',
    'Health Insurance Provider': rand(INSURANCE),
    Birthdate: genDate(1998,2006),
    'City of Birth': rand(CITIES),
    'State or Province of Birth': rand(STATES),
    'Country of Birth': country,
    "Father's First Name": rand(FIRST),
    "Father's Middle Name": '',
    "Father's Last Name": last,
    "Mother's First Name": rand(FIRST),
    "Mother's Middle Name": '',
    "Mother's Last Name": rand(LAST),
    'Gender Identity': rand(GENDERS),
    'Secondary Passport Last Name':  secPassport ? last : '',
    'Secondary Passport First Name': secPassport ? first : '',
    'Secondary Passport Country':    secPassport ? rand(COUNTRIES) : '',
    'Secondary Passport Number':     secPassport ? genPassport('S') : '',
    'Secondary Passport Validity Date':    secPassport ? genDate(2021,2023) : '',
    'Secondary Passport Expiration Date':  secPassport ? genDate(2028,2033) : '',
    'Marital Status': rand(MARITAL),
    Address: `${randInt(1,999)} ${rand(STREETS)}, ${rand(CITIES)}, ${rand(STATES)} ${randInt(10000,99999)}`,
    Race: '',
    'Housing Exemption Status': Math.random() < 0.1 ? 'Exempted' : '',
    'Emergency Contact Type':  rand(EC_TYPES),
    'Emergency Contact Name':  `${ecFirst} ${last}`,
    'Emergency Contact Phone': genPhone(),
    'Emergency Contact Email': `${ecFirst.toLowerCase()}${randInt(1,99)}@email.com`,
    'Alt Emergency Contact Type':  rand(EC_TYPES),
    'Alt Emergency Contact Name':  `${altFirst} ${rand(LAST)}`,
    'Alt Emergency Contact Phone': genPhone(),
    'Alt Emergency Contact Email': `${altFirst.toLowerCase()}${randInt(1,99)}@email.com`,
    'Geoblue Certificate Number':        `GB${randInt(100000,999999)}`,
    'Geoblue Coverage Valid From Date':  genDate(2025,2025),
    'Geoblue Coverage Valid Through Date': genDate(2026,2026),
  };
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const lines   = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

// ── Build pool ─────────────────────────────────────────────────────────────────
// 10 shared + 4×110 exclusive = 450 total
const SHARED_COUNT = 10;
const EXCL_PER     = 110;
const pool         = [];
const usedEmails   = new Set();

for (let i = 0; i < SHARED_COUNT + 4 * EXCL_PER; i++) {
  let s = generateStudent();
  while (usedEmails.has(s.Email)) s = generateStudent();
  usedEmails.add(s.Email);
  pool.push(s);
}

// ── Generate CSVs ──────────────────────────────────────────────────────────────
for (let i = 0; i < SEMESTERS.length; i++) {
  const s   = SEMESTERS[i];
  const target = randInt(100, 120);

  // Shared: random subset of the 10 common students (1-10)
  const sharedCount = randInt(1, SHARED_COUNT);
  const sharedIdx   = [];
  while (sharedIdx.length < sharedCount) {
    const idx = Math.floor(Math.random() * SHARED_COUNT);
    if (!sharedIdx.includes(idx)) sharedIdx.push(idx);
  }
  const shared = sharedIdx.map(idx => ({ ...pool[idx] }));

  // Exclusive slice for this cohort
  const sliceStart = SHARED_COUNT + i * EXCL_PER;
  const needed     = target - shared.length;
  const exclusive  = pool.slice(sliceStart, sliceStart + needed).map(s => ({ ...s }));

  const students = [...shared, ...exclusive];

  // Stamp admit term
  for (const st of students) st['Admit Term at NYU AD'] = s.label;

  const outPath = path.join(outDir, `students_${s.key}.csv`);
  fs.writeFileSync(outPath, toCsv(students), 'utf-8');
  console.log(`✅ students_${s.key}.csv  (${students.length} students, ${shared.length} shared)`);
}
