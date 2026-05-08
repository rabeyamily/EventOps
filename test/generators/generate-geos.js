/**
 * Generates GEO staff list CSVs for 4 semesters.
 * 3 GEOs are common across all semesters; the rest rotate.
 *
 * Output: test/geos/{semester_key}/geo_list.csv (one directory per term)
 * Run:    node test/generators/generate-geos.js
 */

const fs   = require('fs');
const path = require('path');

const GEO_POOL = [
  // ── Common across all semesters ──
  { short: 'Sana',   fullName: 'Sana Khalil',        email: 'sk4821@nyu.edu', uaePhone: '+971562110001', whatsapp: '+971562110001', phone: '+971562110001', common: true  },
  { short: 'Rami',   fullName: 'Rami Oueida',         email: 'ro3377@nyu.edu', uaePhone: '+971550223002', whatsapp: '+971550223002', phone: '+971550223002', common: true  },
  { short: 'Priya',  fullName: 'Priya Menon',         email: 'pm9902@nyu.edu', uaePhone: '+971543310033', whatsapp: '+971543310033', phone: '+971543310033', common: true  },
  // ── Rotating pool ──
  { short: 'Dara',   fullName: 'Dara Okonkwo',        email: 'do7741@nyu.edu', uaePhone: '+971556780044', whatsapp: '+971556780044', phone: '+971556780044', common: false },
  { short: 'Lena',   fullName: 'Lena Brandt',         email: 'lb2265@nyu.edu', uaePhone: '+971508890055', whatsapp: '+49176555001',  phone: '+971508890055', common: false },
  { short: 'Tariq',  fullName: 'Tariq Al Sayed',      email: 'ts6610@nyu.edu', uaePhone: '+971527770066', whatsapp: '+971527770066', phone: '+971527770066', common: false },
  { short: 'Amara',  fullName: 'Amara Diallo',        email: 'ad8831@nyu.edu', uaePhone: '+971509980077', whatsapp: '+221772200077', phone: '+971509980077', common: false },
  { short: 'Kai',    fullName: 'Kai Nakagawa',        email: 'kn1155@nyu.edu', uaePhone: '+971556650088', whatsapp: '+81901234088',  phone: '+971556650088', common: false },
  { short: 'Yasmin', fullName: 'Yasmin Ferreira',     email: 'yf4490@nyu.edu', uaePhone: '+971543210099', whatsapp: '+5511999900099',phone: '+971543210099', common: false },
  { short: 'Idris',  fullName: 'Idris Kowalski',      email: 'ik7723@nyu.edu', uaePhone: '+971526540110', whatsapp: '+48604700110',  phone: '+971526540110', common: false },
  { short: 'Nour',   fullName: 'Nour Mansouri',       email: 'nm3348@nyu.edu', uaePhone: '+971558820121', whatsapp: '+971558820121', phone: '+971558820121', common: false },
  { short: 'Elsa',   fullName: 'Elsa Lindqvist',      email: 'el6614@nyu.edu', uaePhone: '+971505550132', whatsapp: '+46709870132',  phone: '+971505550132', common: false },
  { short: 'Ziad',   fullName: 'Ziad Hassanein',      email: 'zh9902@nyu.edu', uaePhone: '+971561230143', whatsapp: '+971561230143', phone: '+971561230143', common: false },
  { short: 'Chloe',  fullName: 'Chloe Marchetti',     email: 'cm2276@nyu.edu', uaePhone: '+971507780154', whatsapp: '+33612340154',  phone: '+971507780154', common: false },
];

const SEMESTERS = [
  { key: 'spring_2025', label: 'Spring 2025' },
  { key: 'fall_2025',   label: 'Fall 2025'   },
  { key: 'spring_2026', label: 'Spring 2026' },
  { key: 'fall_2026',   label: 'Fall 2026'   },
];

const outDir = path.join(__dirname, '..', 'geos');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const v = String(row[h] ?? '');
      return v.includes(',') ? `"${v}"` : v;
    }).join(','));
  }
  return lines.join('\n');
}

const common   = GEO_POOL.filter(g => g.common);
const rotating = shuffle(GEO_POOL.filter(g => !g.common));
const slices   = [
  rotating.slice(0, 3),
  rotating.slice(3, 6),
  rotating.slice(6, 9),
  rotating.slice(9, 12),
];

for (let i = 0; i < SEMESTERS.length; i++) {
  const s    = SEMESTERS[i];
  const geos = [...common, ...slices[i]];

  const rows = geos.map(g => ({
    semester: s.label,
    fullName: g.fullName,
    email:    g.email,
    role:     'staff',
    position: 'GEO',
    uaePhone: g.uaePhone,
    whatsapp: g.whatsapp,
    phone:    g.phone,
  }));

  const termDir = path.join(outDir, s.key);
  fs.mkdirSync(termDir, { recursive: true });
  const outPath = path.join(termDir, 'geo_list.csv');
  fs.writeFileSync(outPath, toCsv(rows), 'utf-8');
  console.log(`✅ geos/${s.key}/geo_list.csv  (${rows.length} GEOs)`);
}

console.log('\nCommon GEOs in every semester:');
common.forEach(g => console.log(`  • ${g.fullName} <${g.email}>`));
