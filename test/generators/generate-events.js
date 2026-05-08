/**
 * Generates event calendar CSVs for 4 semesters.
 * Lead Organizer and Staff at Event names match the GEO_POOL below.
 * Spring = Jan–May, Fall = Aug–Dec.
 *
 * Output: test/events/events_{semester}.csv
 * Run:    node test/generators/generate-events.js
 */

const fs   = require('fs');
const path = require('path');

// Keep in sync with generate-geos.js
const GEO_POOL = [
  { short: 'Sana',   fullName: 'Sana Khalil',    email: 'sk4821@nyu.edu', common: true  },
  { short: 'Rami',   fullName: 'Rami Oueida',     email: 'ro3377@nyu.edu', common: true  },
  { short: 'Priya',  fullName: 'Priya Menon',     email: 'pm9902@nyu.edu', common: true  },
  { short: 'Dara',   fullName: 'Dara Okonkwo',    email: 'do7741@nyu.edu', common: false },
  { short: 'Lena',   fullName: 'Lena Brandt',     email: 'lb2265@nyu.edu', common: false },
  { short: 'Tariq',  fullName: 'Tariq Al Sayed',  email: 'ts6610@nyu.edu', common: false },
  { short: 'Amara',  fullName: 'Amara Diallo',    email: 'ad8831@nyu.edu', common: false },
  { short: 'Kai',    fullName: 'Kai Nakagawa',    email: 'kn1155@nyu.edu', common: false },
  { short: 'Yasmin', fullName: 'Yasmin Ferreira', email: 'yf4490@nyu.edu', common: false },
  { short: 'Idris',  fullName: 'Idris Kowalski',  email: 'ik7723@nyu.edu', common: false },
  { short: 'Nour',   fullName: 'Nour Mansouri',   email: 'nm3348@nyu.edu', common: false },
  { short: 'Elsa',   fullName: 'Elsa Lindqvist',  email: 'el6614@nyu.edu', common: false },
  { short: 'Ziad',   fullName: 'Ziad Hassanein',  email: 'zh9902@nyu.edu', common: false },
  { short: 'Chloe',  fullName: 'Chloe Marchetti', email: 'cm2276@nyu.edu', common: false },
];

const EVENT_POOL = [
  'Arrival Window: Yas Mall and Ikea Trip',
  'On-campus presentations + Yas Marina Karting + Mosque Visit (Saudi Kitchen)',
  'Desert Safari',
  'Dubai Cultural Day: Heritage Express: Culture on Wheels',
  'GEO Event: Discover the Neighbourhood',
  'AD Through Food Madinat Zayed + Hosn Festival',
  'Jubail Kayaking',
  'Mina Souqs',
  'Al Ain Day',
  'Yas Marina Training',
  'Camping Trip',
  'Camping Trip Day 2',
  'Ghabga (Ramadan Event)',
  'Dubai Miracle Garden and Global Village',
  'Ramadan Arcade MAS',
  'Teamlabs + Iftar',
  'Abaya/Kandura Shopping',
  'Qasr Al Watan',
  'Karaoke/Just Dance/Mafia Night',
  'Burj Khalifa and Dubai Mall',
  'Northern Emirates and Oman Trip',
  'Bubble Soccer/Tug of War',
  'Museum of the Future and Ski Dubai',
  'Qasr Al Hosn Workshops',
  'Perfume Making Workshop',
  'Saadiyat Museum Day',
  'City Wide Scavenger Hunt',
  'Atlantis Day Trip',
  'Henna Night',
  'Corniche Walk + Sunset Yoga',
  'Louvre Abu Dhabi Visit',
  'Beach Day + BBQ',
  'Ferrari World Trip',
  'Mangrove Kayaking',
  'Movie Night on Campus',
  'Pottery Making Workshop',
  'Old Souq Tour + Lunch',
  'Farewell Dinner',
  'Cultural Dance Workshop',
  'Abu Dhabi City Tour',
  'Ice Skating at Galleria',
  'Trivia Night',
  'Warner Bros World Trip',
  'Arabic Calligraphy Workshop',
  'On-campus Welcome Reception',
  'Friday Brunch Outing',
  'Saadiyat Beach Cleanup',
  'Sharjah Art Museum Trip',
];

const NOTES_OPTIONS = [
  'Transport provided', 'Lunch included', 'Bring sunscreen',
  'Team event', 'RSVP required', 'Dress code: smart casual',
  'Meet at main gate', '', '', '', '',   // empty = no note (more likely)
];

const SEMESTERS = [
  { key: 'spring_2025', label: 'Spring 2025', year: 2025, months: [0,1,2,3,4] }, // Jan–May
  { key: 'fall_2025',   label: 'Fall 2025',   year: 2025, months: [7,8,9,10,11] }, // Aug–Dec
  { key: 'spring_2026', label: 'Spring 2026', year: 2026, months: [0,1,2,3,4] },
  { key: 'fall_2026',   label: 'Fall 2026',   year: 2026, months: [7,8,9,10,11] },
];

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const outDir = path.join(__dirname, '..', 'events');

// ── helpers ──────────────────────────────────────────────────────────────────

function rand(arr)            { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max)    { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GEOs available in this semester (common + one rotating slice)
function semesterGeos(semIdx) {
  const common   = GEO_POOL.filter(g => g.common);
  const rotating = shuffle(GEO_POOL.filter(g => !g.common));
  const slice    = rotating.slice(semIdx * 3, semIdx * 3 + 3);
  return [...common, ...slice]; // 6 GEOs per semester
}

function pickStaff(geos) {
  const count = randInt(2, Math.min(4, geos.length));
  return shuffle(geos).slice(0, count).map(g => g.short).join(', ');
}

function escapeCsv(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build a calendar-format CSV for one semester
function buildCsv(semIdx) {
  const sem   = SEMESTERS[semIdx];
  const geos  = semesterGeos(semIdx);

  // Pick 28-35 distinct dates spread across the semester months
  const numEvents = randInt(28, 35);
  const usedDates = new Set();
  const dated     = [];

  for (let n = 0; n < numEvents; n++) {
    let attempts = 0;
    while (attempts < 100) {
      const m   = rand(sem.months);
      const max = new Date(sem.year, m + 1, 0).getDate();
      const d   = randInt(1, max);
      const key = `${m}-${d}`;
      if (!usedDates.has(key)) {
        usedDates.add(key);
        dated.push({ month: m, day: d });
        break;
      }
      attempts++;
    }
  }
  dated.sort((a, b) => a.month - b.month || a.day - b.day);

  // Assign shuffled events
  const names = shuffle(EVENT_POOL).slice(0, dated.length);

  // Group into weeks of ≤7, breaking on month change
  const groups = [];
  let cur       = [];
  let curMonth  = -1;

  for (let i = 0; i < dated.length; i++) {
    if (cur.length >= 7 || (curMonth !== -1 && dated[i].month !== curMonth)) {
      if (cur.length) groups.push(cur);
      cur = [];
    }
    cur.push({ date: dated[i], name: names[i] });
    curMonth = dated[i].month;
  }
  if (cur.length) groups.push(cur);

  const lines      = [];
  let lastMonth    = -1;

  for (const group of groups) {
    if (group[0].date.month !== lastMonth) {
      lastMonth = group[0].date.month;
      lines.push(MONTH_LONG[lastMonth]);
    }

    const dateCells  = group.map(g => `${MONTH_SHORT[g.date.month]}-${g.date.day}`);
    const progCells  = group.map(g => escapeCsv(g.name));
    const notesCells = group.map(() => escapeCsv(rand(NOTES_OPTIONS)));
    const leadCells  = group.map(() => rand(geos).short);
    const staffCells = group.map(() => escapeCsv(pickStaff(geos)));

    lines.push(['Date',           ...dateCells ].join(','));
    lines.push(['Programming',    ...progCells ].join(','));
    lines.push(['Notes',          ...notesCells].join(','));
    lines.push(['Lead Organizer', ...leadCells ].join(','));
    lines.push(['Staff at Event', ...staffCells].join(','));
  }

  return { csv: lines.join('\n'), count: dated.length, geos };
}

// ── generate ─────────────────────────────────────────────────────────────────

for (let i = 0; i < SEMESTERS.length; i++) {
  const s            = SEMESTERS[i];
  const { csv, count, geos } = buildCsv(i);
  const outPath      = path.join(outDir, `events_${s.key}.csv`);

  fs.writeFileSync(outPath, csv, 'utf-8');
  console.log(`✅ events_${s.key}.csv  (${count} events, GEOs: ${geos.map(g=>g.short).join(', ')})`);
}
