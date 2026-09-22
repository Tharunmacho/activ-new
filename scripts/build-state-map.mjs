/**
 * Turns district boundaries into the SVG paths the state pages' maps draw.
 *
 * =========================================================================
 * WHY THIS IS A SCRIPT AND NOT A FETCH AT RUNTIME
 * =========================================================================
 *
 * The source is 28MB of GeoJSON for all 641 districts of India. A page needs
 * the districts of ONE state, as SVG path data, at a size a browser can parse
 * in a frame — so the filtering, the simplification, the projection and the
 * zoning all happen HERE, once. Each state ships as its own module of about
 * seventy kilobytes, loaded only by the page that draws it, with no map
 * library, no runtime request and nothing to fail on a slow connection.
 *
 * ------------------------------------------------------------------ source
 *
 *   datta07/INDIAN-SHAPEFILES — INDIA/INDIA_DISTRICTS.geojson
 *   https://github.com/datta07/INDIAN-SHAPEFILES          MIT licence
 *   820 features, current district boundaries.
 *
 * MIT is why this source and not one of the half-dozen easier ones: most India
 * boundary repositories publish no licence at all, and unlicensed geodata in a
 * client's repository is a problem nobody notices until it is one. The obvious
 * alternative, udit-001/india-maps-data, is a good dataset with no licence file
 * at all, which is the case this rule exists for.
 *
 * ------------------------------------------- what replaced the 2011 census
 *
 * This was `datameet/maps` Census of India 2011, and the arithmetic caught up
 * with it: TAMIL NADU HAS HAD 38 DISTRICTS SINCE 2020 and that file draws 32.
 * Chengalpattu, Kallakkurichi, Mayiladuthurai, Ranipet, Tenkasi and Tirupathur
 * were carved out of neighbours after the census, so no outline for any of
 * them existed — and the site papered over it by ALIASING each new district to
 * the one it came from, which pinned a Chengalpattu chapter on the
 * Kancheepuram shape and could not draw the border between them. Every other
 * state had the same gap: Telangana did not exist in 2011 and its ten old
 * districts are now thirty-three.
 *
 * Both shapes of file are still accepted — `ST_NM`/`DISTRICT` for the census
 * and `state`/`district` for this one — so regenerating from the census is
 * still possible and still correct, and neither is silently assumed.
 *
 * ------------------------------------------------------------------ running
 *
 *   node scripts/build-state-map.mjs <districts.geojson>          # every state
 *   node scripts/build-state-map.mjs <districts.geojson> "Kerala" # just one
 *
 * Writes src/data/maps/<slug>.ts, one per state, plus index.ts. The download is
 * deliberately NOT done here: 28MB on every run, to regenerate files that
 * change when the Census does, is a build step that punishes everybody for
 * nothing.
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , src, only] = process.argv;

if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/build-state-map.mjs <dists11.geojson> ["State"]');
  process.exit(1);
}

/* ------------------------------------------------------------------ states */

/**
 * WHAT THE PAGES NEED, AND WHAT THE SOURCE CALLS IT.
 *
 * `census` is the state name in the source; `label` is what the association
 * calls the place and what the state page is titled. States are matched on a
 * NORMALISED key — case folded, `&` read as "and", punctuation dropped —
 * because the two accepted sources disagree on all three and none of those
 * disagreements is about which state is meant.
 *
 * ------------------------------------------------ `legacy`, and when it runs
 *
 * Telangana became a state in 2014 and Ladakh in 2019, so in the 2011 census
 * their districts are filed under Andhra Pradesh and Jammu & Kashmir. `take`
 * lifts them out by name and `drop` keeps the parent from drawing them twice.
 *
 * A CURRENT source names both states itself, and running those rules against
 * one would be worse than useless: `take` would look for ten district names
 * that no longer exist and Telangana would come out EMPTY — a state with no
 * map at all, which the site renders as a page with no map and no complaint.
 *
 * So `legacy` is the fallback, not the rule: it is used only when the source
 * has no features under the state’s own name.
 */
const TELANGANA = [
  'Adilabad', 'Nizamabad', 'Karimnagar', 'Medak', 'Hyderabad', 'Rangareddy',
  'Mahbubnagar', 'Nalgonda', 'Warangal', 'Khammam',
];

/**
 * Ladakh is the other 2014-and-after change, the same shape as Telangana:
 * created in 2019 out of Jammu & Kashmir, so its two districts are still filed
 * there. `take` lifts them out and `drop` keeps them from being drawn twice.
 */
const LADAKH = ['Leh(Ladakh)', 'Kargil'];

/**
 * EVERY STATE AND UNION TERRITORY THE ASSOCIATION HAS A REGION FOR.
 *
 * The labels are `cms.regionMap.js`'s, because the slug the CMS and the URL use
 * is derived from them and the map is looked up by that slug. The `census`
 * column is the `ST_NM` in the source, which differs often enough — spelling,
 * mergers, states that did not exist in 2011 — to be worth naming every time
 * rather than guessing.
 */
const STATES = [
  /* South */
  { label: 'Tamil Nadu', census: 'Tamil Nadu' },
  { label: 'Andhra Pradesh', census: 'Andhra Pradesh', legacy: { drop: TELANGANA } },
  { label: 'Telangana', census: 'Telangana', legacy: { census: 'Andhra Pradesh', take: TELANGANA } },
  { label: 'Karnataka', census: 'Karnataka' },
  { label: 'Kerala', census: 'Kerala' },
  { label: 'Puducherry', census: 'Puducherry' },
  { label: 'Lakshadweep', census: 'Lakshadweep' },
  { label: 'Andaman and Nicobar Islands', census: ['Andaman & Nicobar Islands', 'Andaman & Nicobar Island'] },

  /* North */
  { label: 'Delhi', census: ['Delhi', 'NCT of Delhi'] },
  { label: 'Haryana', census: 'Haryana' },
  { label: 'Punjab', census: 'Punjab' },
  { label: 'Rajasthan', census: 'Rajasthan' },
  { label: 'Uttar Pradesh', census: 'Uttar Pradesh' },
  { label: 'Uttarakhand', census: 'Uttarakhand' },
  { label: 'Himachal Pradesh', census: 'Himachal Pradesh' },
  { label: 'Jammu and Kashmir', census: 'Jammu & Kashmir', legacy: { drop: LADAKH } },
  { label: 'Ladakh', census: 'Ladakh', legacy: { census: 'Jammu & Kashmir', take: LADAKH } },
  { label: 'Chandigarh', census: 'Chandigarh' },

  /* East */
  { label: 'Bihar', census: 'Bihar' },
  { label: 'Jharkhand', census: 'Jharkhand' },
  { label: 'Odisha', census: 'Odisha' },
  { label: 'West Bengal', census: 'West Bengal' },

  /* West */
  { label: 'Goa', census: 'Goa' },
  { label: 'Gujarat', census: 'Gujarat' },
  { label: 'Maharashtra', census: 'Maharashtra' },
  { label: 'Madhya Pradesh', census: 'Madhya Pradesh' },
  { label: 'Chhattisgarh', census: 'Chhattisgarh' },
  {
    /* Merged in 2020, so a current source has it as one territory and the
       2011 set has it as two. Both spellings are listed; the normalised
       match means only the ones that are present contribute. */
    label: 'Dadra and Nagar Haveli and Daman and Diu',
    census: ['Dadra & Nagar Haveli & Daman & Diu', 'Dadara & Nagar Havelli', 'Daman & Diu'],
  },

  /* North East */
  { label: 'Assam', census: 'Assam' },
  { label: 'Arunachal Pradesh', census: ['Arunachal Pradesh', 'Arunanchal Pradesh'] },
  { label: 'Manipur', census: 'Manipur' },
  { label: 'Meghalaya', census: 'Meghalaya' },
  { label: 'Mizoram', census: 'Mizoram' },
  { label: 'Nagaland', census: 'Nagaland' },
  { label: 'Sikkim', census: 'Sikkim' },
  { label: 'Tripura', census: 'Tripura' },
];

/* ------------------------------------------------------------------ shapes */

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The source's spelling, tidied only where it is inconsistent with itself.
 *
 * ------------------------------------------------------ the bracketed four
 *
 * Four districts are filed with their alternative name in lowercase inside a
 * bracket — `Leh (ladakh)`, `Kaimur (bhabua)`, `Saran (chhapra)` and
 * `Sant Ravi Das Nagar(bhadohi)`. Everything else in the census file is title
 * case, so these read on a map legend as a typo rather than as a second name,
 * and the last of the four is missing its space as well.
 *
 * ------------------------------------------------------------ and ALL CAPS
 *
 * The current source shouts every name: `TIRUVANNAMALAI`, `THE NILGIRIS`.
 * Printed straight onto a tooltip and a legend beside sentence-case headings,
 * that reads as an error on the page rather than as a district. A name that is
 * ALL upper case is title cased; one that is already mixed is left exactly as
 * it came, because the census’s own capitalisation is the authority on names
 * like `The Nilgiris` and `Y.S.R.`.
 *
 * Beyond that the name is NOT normalised. The CMS matches chapters to shapes
 * by this string, and re-spelling Indian district names to taste is how a map
 * quietly stops finding half its pins.
 */
const SMALL_WORDS = new Set(['and', 'of', 'the']);

const titleCase = (name) => name.toLowerCase().replace(/[^\s(]+/g, (word, at) => (
  at > 0 && SMALL_WORDS.has(word)
    ? word
    : word.charAt(0).toUpperCase() + word.slice(1)
));

/**
 * ==========================================================================
 * THE LONG VOWELS CAME THROUGH AS PUNCTUATION
 * ==========================================================================
 *
 * The source romanises with macrons — Bāgeshwar, Hamīrpur, Dehradūn — and
 * somewhere upstream of the file those three characters were written out in
 * a single-byte encoding and read back as ASCII:
 *
 *     ā / Ā  ->  >        ī / Ī  ->  |        ū / Ū  ->  @
 *
 * Forty-four district names across six states arrive as `B>geshwar`,
 * `B|rbh@m`, `D>rjiling`, `>nj>w`. They render exactly like that on a map
 * legend and in a tooltip, and — worse — none of them matches the name an
 * editor types, so every one of those districts was a chapter that could
 * never draw a marker. It is the Tiruvannamalai failure forty-four times,
 * caused by the dataset rather than by a typo.
 *
 * The three characters cannot occur in an Indian district name in any other
 * way — `>`, `|` and `@` are not letters — so the substitution is safe and
 * unambiguous. The accent is dropped rather than restored: the rest of the
 * file is unaccented ASCII, and one macron among six hundred plain names
 * would be the odd one out on the legend rather than the correct one.
 *
 * `_` is the same class of fault in one name (`Medchal_malkajgiri`) and is
 * a space.
 */
const MOJIBAKE = { '>': 'a', '|': 'i', '@': 'u', '_': ' ' };

const deaccent = (name) => name.replace(/[>|@_]/g, (c) => MOJIBAKE[c]);

const tidy = (name) => {
  const source = String(name || '').trim();
  /*
   * SHOUTING IS DECIDED BEFORE THE SUBSTITUTION IS UNDONE.
   *
   * `PURBA BARDDHAM>N` is an all-capitals name, and repairing it first gives
   * `PURBA BARDDHAMaN` — which is no longer equal to its own upper case, so
   * the title-casing below skipped it and the legend read PURBA BARDDHAMaN.
   * The question 'did this arrive shouted' is about the source string.
   */
  const shouting = source !== '' && source === source.toUpperCase();
  const raw = deaccent(source);
  const mixed = shouting ? titleCase(raw) : raw;
  /* `Ānjaw` arrived as `>njaw` and is now `anjaw`: a name whose first letter
     was the substituted one has lost its capital, and nothing else here can
     produce a lowercase opening letter. */
  const cased = mixed.charAt(0).toUpperCase() + mixed.slice(1);
  return cased
    .replace(/\s*\(\s*/, ' (')
    .replace(/\(([a-z])/, (_, c) => `(${c.toUpperCase()}`);
};
const camel = (s) => slug(s).replace(/-(.)/g, (_, c) => c.toUpperCase());

/* ------------------------------------------------------------ simplifying */

/**
 * Douglas–Peucker, on the raw lon/lat ring.
 *
 * A census boundary carries a vertex every few metres — detail invisible at the
 * size this is drawn and most of the file. 0.004° is roughly 400m, under half a
 * pixel here.
 */
const perpendicular = (p, a, b) => {
  const [px, py] = p; const [ax, ay] = a; const [bx, by] = b;
  const dx = bx - ax; const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const simplify = (points, tolerance) => {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicular(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
};

/** Shoelace area, for dropping offshore specks nobody can click. */
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(a / 2);
};

/* -------------------------------------------------------------------- zones */

/**
 * WHICH ZONE A DISTRICT IS IN, WORKED OUT FROM WHERE IT IS.
 *
 * The association divides a state into four and names them by compass point.
 * Deriving that from the geometry — the angle of a district's centre from the
 * state's centre — gives every state the same four zones for free, and gives
 * them correctly: a district in the north-east of a state is in the North or
 * the East by the same rule everywhere, rather than by whoever typed the list.
 *
 * TAMIL NADU IS THE EXCEPTION and is hand-listed below, because the client
 * supplied their own two ("SOUTH REGION: Madurai, Tirunelveli, Thoothukudi,
 * Virudhunagar"; "NORTH REGION: Chennai, Kancheepuram, Tiruvallur, Hosur") and
 * a real association's zones are an administrative fact, not a geometric one.
 * Any other state can be given the same treatment by adding it here.
 *
 * A state with four districts or fewer is left UNZONED — four zones over four
 * districts is a legend with one entry per shape, which explains nothing.
 */
const ZONE_ORDER = ['north', 'east', 'south', 'west'];

/*
 * ALL 38, AND BOTH SPELLINGS OF THE ONES THAT MOVED.
 *
 * The six districts created in 2019-2020 are listed in the zone their parent
 * was in, which is where they physically are: Chengalpattu and Ranipet and
 * Tirupathur in the North with Kancheepuram and Vellore, Kallakkurichi with
 * Viluppuram, Mayiladuthurai with Nagapattinam in the East, Tenkasi with
 * Tirunelveli in the South.
 *
 * Both spellings of the five the two sources disagree about are listed —
 * Kanchipuram / Kancheepuram, Nagapattinam / Nagappattinam, Thoothukudi /
 * Thoothukkudi, Virudhunagar / Virudunagar, Kallakkurichi / Kallakurichi —
 * because the lookup is by exact slug and a name that misses does not fail
 * loudly: the district silently falls back to the geometric zone, which for
 * a coastal district is usually a different colour and never an error.
 */
const HAND_ZONES = {
  'tamil-nadu': {
    north: [
      'Chennai', 'Thiruvallur', 'Tiruvallur', 'Kanchipuram', 'Kancheepuram',
      'Chengalpattu', 'Vellore', 'Ranipet', 'Tirupathur', 'Tirupattur',
      'Tiruvannamalai', 'Viluppuram', 'Kallakkurichi', 'Kallakurichi',
      'Cuddalore', 'Krishnagiri', 'Dharmapuri',
    ],
    west: [
      'Coimbatore', 'Tiruppur', 'Erode', 'The Nilgiris', 'Salem',
      'Namakkal', 'Karur', 'Dindigul',
    ],
    east: [
      'Thanjavur', 'Thiruvarur', 'Tiruvarur', 'Nagapattinam', 'Nagappattinam',
      'Mayiladuthurai', 'Tiruchirappalli', 'Perambalur', 'Ariyalur',
      'Pudukkottai',
    ],
    south: [
      'Madurai', 'Theni', 'Virudhunagar', 'Virudunagar', 'Ramanathapuram',
      'Sivaganga', 'Thoothukudi', 'Thoothukkudi', 'Tenkasi', 'Tirunelveli',
      'Kanniyakumari',
    ],
  },
};

/**
 * Every hand-zoned district must actually be in the state, and every district
 * of a hand-zoned state must be in exactly one zone.
 *
 * Both halves have gone wrong: a rename left a district in no zone and drawn
 * by angle, and a district listed twice took whichever zone was found first.
 * Neither shows on the map as a fault — the shape is simply the wrong colour,
 * on a map whose colours nobody can check by eye. The build says so instead.
 */
const auditZones = (stateSlug, hand, rows) => {
  const names = new Set(rows.map((r) => r.slug));
  const seen = new Map();

  Object.entries(hand).forEach(([zone, list]) => list.forEach((n) => {
    const key = slug(n);
    if (!names.has(key)) return;   /* the other source’s spelling; expected */
    if (seen.has(key)) {
      console.warn(`  ! ${stateSlug}: ${n} is in both ${seen.get(key)} and ${zone}`);
      return;
    }
    seen.set(key, zone);
  }));

  const missing = rows.filter((r) => !seen.has(r.slug)).map((r) => r.name);
  if (missing.length) {
    console.warn(`  ! ${stateSlug}: no zone listed for ${missing.join(', ')}`
      + ' — drawn by angle instead');
  }
};

/** North / East / South / West from the angle off the state's centre. */
const zoneByAngle = (x, y, cx, cy) => {
  const dx = x - cx;
  const dy = cy - y; // screen y grows downward; flip so north is positive
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'north' : 'south';
  return dx >= 0 ? 'east' : 'west';
};

/* ------------------------------------------------------------------- build */

const raw = JSON.parse(fs.readFileSync(src, 'utf8'));

const TOLERANCE = 0.004;
const MIN_AREA = 0.0009;
const WIDTH = 520;

/**
 * The two property namings, read through one pair of accessors.
 *
 * `ST_NM`/`DISTRICT` is the census's; `state`/`district` is the current
 * source’s. Reading whichever is present is two lines, and the alternative —
 * assuming one — fails as a file that parses, filters to nothing and writes
 * no maps, with nothing on screen saying which of the two things went wrong.
 */
const stateOf = (f) => String(f.properties.ST_NM ?? f.properties.state ?? '').trim();
const districtOf = (f) => String(f.properties.DISTRICT ?? f.properties.district ?? '').trim();

/** `&` is "and", case does not count, and neither does anything else. */
const stateKey = (n) => String(n || '').toLowerCase().replace(/&/g, 'and')
  .replace(/[^a-z]/g, '');

/** Whether the source names this state at all — what `legacy` turns on. */
const sourceHas = (census) => {
  const keys = (Array.isArray(census) ? census : [census]).map(stateKey);
  return raw.features.some((f) => keys.includes(stateKey(stateOf(f))));
};

/**
 * ==========================================================================
 * KARNATAKA'S NAMES ARE BROKEN IN THE SOURCE, AND ONLY KARNATAKA'S
 * ==========================================================================
 *
 * Sixteen of its thirty-one districts arrive truncated at their first
 * non-ASCII letter, or with that letter replaced by a hash:
 *
 *     'B'  'Ball'  'Belag'  'Ch'  'D'  'Dh'  'H'  'H'  'Kol'  'R'  'Y'
 *     'B\\dar'  'Bengal#ru (Rural)'  'Mys#ru'  'Raich#r'  'Tumak#ru'
 *
 * The GEOMETRY is intact — it is a text-encoding fault in the upstream file,
 * and it is confined to this one state; every other district in all 820
 * features reads correctly. Dropping Karnataka was not an option (it is in
 * the South region, with Tamil Nadu) and neither was shipping a legend that
 * says "H".
 *
 * ------------------------------------------------- how each one was checked
 *
 * Every repair below was confirmed against the feature’s own centroid, not
 * guessed from the stub. `B` is at 16.35N 75.25E, which is Bagalkote and
 * nothing else; `B\\dar` is at 17.98N, which is Bidar.
 *
 * `H` APPEARS TWICE and is the only ambiguous one, so it is the only entry
 * resolved by position: Haveri is at 14.76N and Hassan at 12.91N, nearly two
 * degrees apart, so the boundary at 13.8N is not a close call. A repair that
 * is a function of the centroid rather than of the stub is also the one that
 * cannot silently swap two districts if the source reorders its features.
 */
const NAME_REPAIRS = {
  karnataka: {
    B: 'Bagalkote',
    Ball: 'Ballari',
    Belag: 'Belagavi',
    Ch: 'Chamarajanagara',
    Chikkaball: 'Chikkaballapura',
    'Chikkamagal#ru': 'Chikkamagaluru',
    D: 'Davanagere',
    Dh: 'Dharwad',
    Kol: 'Kolar',
    R: 'Ramanagara',
    Y: 'Yadgir',
    'B\\dar': 'Bidar',
    'Bengal#ru (Rural)': 'Bengaluru Rural',
    'Bengal#ru (Urban)': 'Bengaluru Urban',
    'Mys#ru': 'Mysuru',
    'Raich#r': 'Raichur',
    'Tumak#ru': 'Tumakuru',
    H: ([, lat]) => (lat > 13.8 ? 'Haveri' : 'Hassan'),
  },
};

/** The mean of a feature’s outer rings — enough to tell two districts apart. */
const centroidOf = (f) => {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let n = 0; let x = 0; let y = 0;
  polys.forEach((p) => p[0].forEach(([lon, lat]) => { x += lon; y += lat; n += 1; }));
  return n ? [x / n, y / n] : [0, 0];
};

const repairName = (stateName, name, feature) => {
  const table = NAME_REPAIRS[slug(stateName)];
  const fix = table && table[name];
  if (!fix) return name;
  return typeof fix === 'function' ? fix(centroidOf(feature)) : fix;
};

/** One state's districts, filtered and simplified. Shared by both passes. */
const collect = (entry) => {
  /* A current source names Telangana and Ladakh itself; only a file that does
     not gets the take/drop rules written for the 2011 census. */
  const { census, take, drop } = sourceHas(entry.census)
    ? entry
    : { ...entry, ...(entry.legacy || {}) };

  const keys = (Array.isArray(census) ? census : [census]).map(stateKey);
  const features = raw.features.filter((f) => {
    if (!keys.includes(stateKey(stateOf(f)))) return false;
    const name = districtOf(f);
    /* The source carries one placeholder row under Jammu & Kashmir for the
       territory it does not have boundaries for. It is a real feature with a
       real polygon, so nothing downstream would reject it — it would simply
       appear in the legend and on the map as a district called "Data Not
       Available". */
    if (/^data not available$/i.test(name)) return false;
    /*
     * Matched on the SLUG, not the string. The census spells Ladakh's capital
     * `Leh (ladakh)` — a space and a lowercase l inside a parenthesis — and a
     * `take` list that misses by one character does not fail loudly: the
     * district stays in the state it is being taken out of and the new state
     * comes out one district short, which looks exactly like a correct map of
     * somewhere slightly wrong.
     */
    const key = slug(name);
    if (take) return take.some((n) => slug(n) === key);
    if (drop) return !drop.some((n) => slug(n) === key);
    return true;
  });

  return features.map((f) => {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const rings = [];
    /* Rings the threshold removed, in case it removed all of them. */
    const dropped = [];
    polys.forEach((poly) => {
      /* Outer ring only. A district's holes are enclaves of another district,
         already drawn on top — cutting them out leaves a white gap between two
         shapes that touch. */
      const outer = poly[0];
      if (ringArea(outer) < MIN_AREA) { dropped.push(outer); return; }
      rings.push(simplify(outer, TOLERANCE));
    });

    /*
     * A DISTRICT MADE ENTIRELY OF SPECKS IS STILL A DISTRICT.
     *
     * `MIN_AREA` is there to drop offshore rocks nobody can click off a
     * mainland district, and for every district on the mainland that is
     * exactly right. For LAKSHADWEEP it removed the territory: ten inhabited
     * islands, none of them a thousandth of a square degree, all under the
     * threshold — so the state collected no rings, was filtered out as
     * empty, and the build printed "skipped Lakshadweep — no districts
     * matched", which reads as a name that failed to match rather than as a
     * place too small for a rule written with Rajasthan in mind.
     *
     * So the threshold applies only where something SURVIVES it. With
     * nothing left, the biggest of what was dropped is kept: the largest
     * island, drawn tiny, which is the honest picture of a territory that is
     * tiny. Kept ALONE rather than all of them, because the point of the
     * rule — one clickable shape per district, not a scatter of dots — holds
     * whatever the scale.
     */
    if (!rings.length && dropped.length) {
      const biggest = dropped.reduce((a, b) => (ringArea(a) >= ringArea(b) ? a : b));
      rings.push(simplify(biggest, TOLERANCE / 8));
    }

    return { name: tidy(repairName(stateOf(f), districtOf(f), f)), rings };
  }).filter((s) => s.name && s.rings.length);
};

const buildState = (entry) => {
  const { label } = entry;
  const shapes = collect(entry);
  if (!shapes.length) return null;

  /* ----------------------------------------------------------- projection */

  let minLon = Infinity; let maxLon = -Infinity;
  let minLat = Infinity; let maxLat = -Infinity;
  shapes.forEach((s) => s.rings.forEach((r) => r.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  })));

  /*
   * Equirectangular, longitude scaled by cos(mean latitude).
   *
   * At the size of one Indian state the difference between this and a proper
   * conic projection is under a pixel, and the correction is the part that
   * matters: without it a state comes out several per cent too wide and reads
   * as subtly wrong to anybody who knows the shape.
   */
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;

  /* A scale that fits the LONGER axis, so a tall state and a wide one are both
     drawn at a sensible size rather than one of them 3,000px deep. */
  const scale = spanX >= spanY ? WIDTH / spanX : WIDTH / spanY;
  const width = Math.max(1, Math.round(spanX * scale));
  const height = Math.max(1, Math.round(spanY * scale));

  const project = ([lon, lat]) => [
    (lon - minLon) * kx * scale,
    (maxLat - lat) * scale,
  ];
  const round = (n) => Math.round(n * 10) / 10;

  const toPath = (rings) => rings.map((ring) => {
    const pts = ring.map(project).map(([x, y]) => `${round(x)} ${round(y)}`);
    return `M${pts.join('L')}Z`;
  }).join('');

  /**
   * A point inside the district, for a marker.
   *
   * Chennai is 426 square kilometres against Villupuram's 7,200 — a few pixels
   * across, which nobody can aim at and no touchscreen will register. The
   * marker is the same size whatever the district's area, and is what most
   * readers actually hit.
   *
   * The centroid of the LARGEST ring, not the mean of all: a district with an
   * offshore island has a mean that sits in the sea between the two.
   */
  const marker = (rings) => {
    const biggest = rings.reduce((a, b) => (ringArea(a) >= ringArea(b) ? a : b));
    let x = 0;
    let y = 0;
    biggest.forEach((pt) => {
      const [px, py] = project(pt);
      x += px;
      y += py;
    });
    return [round(x / biggest.length), round(y / biggest.length)];
  };

  const stateSlug = slug(label);
  const hand = HAND_ZONES[stateSlug];

  const rows = shapes.map((s) => {
    const [cx, cy] = marker(s.rings);
    return { name: s.name, slug: slug(s.name), d: toPath(s.rings), cx, cy };
  }).sort((a, b) => a.name.localeCompare(b.name));

  /* Four zones over four districts is a legend with one entry per shape. */
  const zoned = rows.length > 5;

  if (zoned) {
    if (hand) auditZones(stateSlug, hand, rows);
    const cx = width / 2;
    const cy = height / 2;
    rows.forEach((row) => {
      if (hand) {
        const key = Object.keys(hand).find(
          (k) => hand[k].some((n) => slug(n) === row.slug),
        );
        row.zone = key || zoneByAngle(row.cx, row.cy, cx, cy);
        return;
      }
      row.zone = zoneByAngle(row.cx, row.cy, cx, cy);
    });
  }

  const zones = zoned
    ? ZONE_ORDER.filter((key) => rows.some((r) => r.zone === key))
    : [];

  return { label, slug: stateSlug, width, height, rows, zones };
};

/* ------------------------------------------------------------------ regions */

/**
 * A REGION IS THE SAME MAP ONE LEVEL UP.
 *
 * The state pages draw districts coloured by zone; a region page draws the same
 * boundaries coloured by STATE, because the thing a reader picks on a region
 * page is a state. One generator, two outputs, one set of boundaries — rather
 * than a second script and a second projection that drift apart the first time
 * the census changes.
 *
 * The member list is the association's own, and matches `cms.regionMap.js` on
 * the server. It is repeated here because this script runs against a file, not
 * against the API, and a build step that needs a running server is a build step
 * that fails on a fresh clone.
 */
const REGIONS = [
  {
    /*
     * ======================================================================
     * INDIA IS A REGION MAP TOO — the same drawing, one level up again
     * ======================================================================
     *
     * A region page draws its states; the national page draws ALL of them.
     * It is the same generator, the same projection and the same component,
     * so the national page gets its map for the cost of this entry and no
     * new code anywhere.
     *
     * `key: national` matches the reserved region key on the server — see
     * `cms.regionMap.js`. It is not one of the association's five regions and
     * it does not appear in the state-to-region mapping; it is the whole
     * country, and every state is in it exactly once by construction.
     */
    key: 'national',
    label: 'India',
    /*
     * COARSER, because the whole country is drawn at the width one state is.
     *
     * At the district tolerance the file came out at 1.5MB — six hundred
     * districts of coastline at four hundred metres a vertex, on a drawing
     * where Goa is nine pixels across. Every one of those vertices is under
     * a tenth of a pixel here, so none of them is visible and all of them
     * are downloaded.
     *
     * 0.05° is about five kilometres, which at this scale is roughly a
     * pixel: the coastline still reads as the coastline and the file is a
     * fifth of the size. It is applied to the region drawing only — the
     * state maps keep their own detail, where it is visible.
     */
    tolerance: 0.05,
    states: [
      'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Karnataka', 'Kerala',
      'Puducherry', 'Lakshadweep', 'Andaman and Nicobar Islands',
      'Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand',
      'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh',
      'Bihar', 'Jharkhand', 'Odisha', 'West Bengal',
      'Goa', 'Gujarat', 'Maharashtra', 'Madhya Pradesh', 'Chhattisgarh',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Sikkim', 'Tripura',
    ],
  },
  {
    key: 'south',
    label: 'South',
    states: [
      'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Karnataka', 'Kerala',
      'Puducherry', 'Lakshadweep', 'Andaman and Nicobar Islands',
    ],
  },
  {
    key: 'north',
    label: 'North',
    states: [
      'Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand',
      'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh',
    ],
  },
  {
    key: 'east',
    label: 'East',
    states: ['Bihar', 'Jharkhand', 'Odisha', 'West Bengal'],
  },
  {
    key: 'west',
    label: 'West',
    states: [
      'Goa', 'Gujarat', 'Maharashtra', 'Madhya Pradesh', 'Chhattisgarh',
      'Dadra and Nagar Haveli and Daman and Diu',
    ],
  },
  {
    key: 'north-east',
    label: 'North East',
    states: [
      'Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Sikkim', 'Tripura',
    ],
  },
];

const buildRegion = (region) => {
  /* Every member state's districts, projected TOGETHER so the region is one
     drawing rather than eight at eight different scales. */
  const members = region.states
    .map((label) => STATES.find((s) => s.label === label))
    .filter(Boolean)
    .map((entry) => ({ entry, shapes: collect(entry) }))
    .filter((m) => m.shapes.length);

  if (!members.length) return null;

  let minLon = Infinity; let maxLon = -Infinity;
  let minLat = Infinity; let maxLat = -Infinity;
  members.forEach((m) => m.shapes.forEach((s) => s.rings.forEach((r) => r.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }))));

  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const scale = spanX >= spanY ? WIDTH / spanX : WIDTH / spanY;
  const width = Math.max(1, Math.round(spanX * scale));
  const height = Math.max(1, Math.round(spanY * scale));

  const project = ([lon, lat]) => [
    (lon - minLon) * kx * scale,
    (maxLat - lat) * scale,
  ];
  const round = (n) => Math.round(n * 10) / 10;

  /*
   * A second simplification pass, for a region drawn much smaller than the
   * states it is made of. Run on the PROJECTED rings would be tidier, but
   * the tolerance is then a different unit per region; degrees are what the
   * first pass used and what the constant beside it is written in.
   */
  const coarse = (ring) => (region.tolerance
    ? simplify(ring, region.tolerance)
    : ring);

  const rows = members.map(({ entry, shapes }) => {
    /* One path per state: every district of it, as subpaths. The white stroke
       then draws the district lines inside the state as well as its border,
       which is what the reference does and what makes a region legible. */
    const d = shapes.flatMap((s) => s.rings).map(coarse).map((ring) => {
      const pts = ring.map(project).map(([x, y]) => `${round(x)} ${round(y)}`);
      return `M${pts.join('L')}Z`;
    }).join('');

    /* The marker goes on the state's LARGEST district, which for every state in
       the south is comfortably inland — a centroid of the whole state lands in
       the sea for Andaman and for Kerala's curve. */
    const biggest = shapes
      .flatMap((s) => s.rings)
      .reduce((a, b) => (ringArea(a) >= ringArea(b) ? a : b));
    let x = 0;
    let y = 0;
    biggest.forEach((pt) => {
      const [px, py] = project(pt);
      x += px;
      y += py;
    });

    return {
      name: entry.label,
      slug: slug(entry.label),
      d,
      cx: round(x / biggest.length),
      cy: round(y / biggest.length),
      districts: shapes.length,
    };
  });

  return { key: region.key, label: region.label, width, height, rows };
};

/* -------------------------------------------------------------- the output */

const outDir = path.join('src', 'data', 'maps');
fs.mkdirSync(outDir, { recursive: true });

const wanted = only ? STATES.filter((s) => s.label === only) : STATES;
if (!wanted.length) {
  console.error(`no state called "${only}" in the table at the head of this script`);
  process.exit(1);
}

const built = [];

wanted.forEach((entry) => {
  const state = buildState(entry);
  if (!state) {
    console.warn(`skipped ${entry.label} — no districts matched`);
    return;
  }

  const body = `/**
 * ${state.label}'s districts, as SVG paths. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson> "${state.label}"
 *
 * Boundaries: Census of India 2011, via datameet/maps (MIT licence).
 * https://github.com/datameet/maps
 *
 * Projected equirectangular with the longitude scaled by cos(mean latitude),
 * simplified to ${TOLERANCE}° (~400m, under half a pixel at the size this is
 * drawn), islands under ${MIN_AREA} square degrees dropped. Zones are worked out
 * from each district's position; see the script for both.
 */
import type { StateMap } from './types';

const map: StateMap = {
    label: ${JSON.stringify(state.label)},
    slug: ${JSON.stringify(state.slug)},
    viewBox: '0 0 ${state.width} ${state.height}',
    zones: ${JSON.stringify(state.zones)},
    districts: ${JSON.stringify(state.rows, null, 4).replace(/\n/g, '\n    ')},
};

export default map;
`;

  fs.writeFileSync(path.join(outDir, `${state.slug}.ts`), body);
  built.push(state);
  console.log(
    `${state.label.padEnd(28)} ${String(state.rows.length).padStart(3)} districts`
    + `  ${state.zones.length} zones  ${(body.length / 1024).toFixed(0)}KB`,
  );
});

/* ----------------------------------------------------------- region maps */

const regionsBuilt = [];

if (!only) {
  REGIONS.forEach((region) => {
    const built2 = buildRegion(region);
    if (!built2) {
      console.warn(`skipped region ${region.label} — no states matched`);
      return;
    }

    const body = `/**
 * The ${built2.label} region, drawn as its member states. GENERATED — do not edit.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson>
 *
 * Boundaries: Census of India 2011, via datameet/maps (MIT licence).
 * Same projection and simplification as the state maps; see the script.
 *
 * One path per state, holding every district of it as a subpath — so the white
 * stroke draws the district lines inside a state as well as its border, which
 * is what makes a region legible rather than a set of blobs.
 */
import type { RegionMapData } from './types';

const map: RegionMapData = {
    key: ${JSON.stringify(built2.key)},
    label: ${JSON.stringify(built2.label)},
    viewBox: '0 0 ${built2.width} ${built2.height}',
    states: ${JSON.stringify(built2.rows, null, 4).replace(/\n/g, '\n    ')},
};

export default map;
`;

    fs.writeFileSync(path.join(outDir, `region-${built2.key}.ts`), body);
    regionsBuilt.push(built2);
    console.log(
      `region ${built2.label.padEnd(21)} ${String(built2.rows.length).padStart(3)} states`
      + `   ${(body.length / 1024).toFixed(0)}KB`,
    );
  });
}

/*
 * THE REGISTRY, AND WHY IT IS DYNAMIC IMPORTS.
 *
 * Eight states of boundary data is about half a megabyte. A reader opens ONE
 * state page, so shipping all eight in the main bundle would make every page on
 * the site — the home page included — carry seven maps nobody is looking at.
 * `() => import(...)` makes each its own chunk, fetched by the page that draws
 * it and by nothing else.
 */
const index = `/**
 * Every state map the site can draw. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson>
 *
 * Keyed by the state's slug, which is the slug the CMS and the URL use. A state
 * that is not here simply has no map, and the page draws the rest of itself —
 * see \`StateDistrictMap\`.
 *
 * Dynamic imports on purpose: one reader opens one state, and eight states of
 * boundaries in the main bundle is seven maps nobody asked for on every page of
 * the site.
 */
import type { StateMap, RegionMapData } from './types';

export type { StateMap, RegionMapData, DistrictShape, ZoneKey } from './types';

export const stateMaps: Record<string, () => Promise<{ default: StateMap }>> = {
${built.map((s) => `    ${JSON.stringify(s.slug)}: () => import('./${s.slug}'),`).join('\n')}
};

export const regionMaps: Record<string, () => Promise<{ default: RegionMapData }>> = {
${regionsBuilt.map((r) => `    ${JSON.stringify(r.key)}: () => import('./region-${r.key}'),`).join('\n')}
};

export const hasStateMap = (slug: string) => !!stateMaps[String(slug || '').toLowerCase()];
`;

fs.writeFileSync(path.join(outDir, 'index.ts'), index);
console.log(`\nindex.ts  ${built.length} states`);
