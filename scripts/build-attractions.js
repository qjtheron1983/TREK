#!/usr/bin/env node
/**
 * TREK Attractions Database Builder
 * Queries OpenStreetMap Overpass API for tourism/historic/natural POIs
 * across Southern Africa and outputs attractions.json
 *
 * Run: node scripts/build-attractions.js
 * Output: attractions.json (committed alongside index.html)
 */

const fs = require('fs');
const path = require('path');

// ── Countries to query ────────────────────────────────────────────────────────
const COUNTRIES = [
  { name: 'Namibia',       code: 'NA' },
  { name: 'South Africa',  code: 'ZA' },
  { name: 'Botswana',      code: 'BW' },
  { name: 'Zimbabwe',      code: 'ZW' },
  { name: 'Zambia',        code: 'ZM' },
  { name: 'Mozambique',    code: 'MZ' },
  { name: 'Eswatini',      code: 'SZ' },
  { name: 'Lesotho',       code: 'LS' },
  { name: 'Malawi',        code: 'MW' },
];

// ── OSM tag → readable type ───────────────────────────────────────────────────
const TYPE_LABEL = {
  attraction: 'attraction', viewpoint: 'scenic viewpoint', museum: 'museum',
  zoo: 'zoo', aquarium: 'aquarium', artwork: 'public artwork', gallery: 'gallery',
  monument: 'monument', ruins: 'ruins', archaeological_site: 'archaeological site',
  memorial: 'memorial', castle: 'castle', fort: 'fort', wreck: 'shipwreck',
  battlefield: 'battlefield', mine: 'historic mine',
  peak: 'mountain peak', waterfall: 'waterfall', hot_spring: 'hot spring',
  cave_entrance: 'cave', arch: 'natural arch', beach: 'beach', bay: 'bay',
  cape: 'cape', gorge: 'gorge', dune: 'dune', rock: 'rock formation',
  volcano: 'volcano', spring: 'natural spring',
  nature_reserve: 'nature reserve', park: 'national park',
  wildlife_hide: 'wildlife hide', camp_site: 'campsite',
  theme_park: 'theme park', information: 'visitor info',
};

// ── Curated high-quality entries (from existing offline list) ─────────────────
// These override/supplement OSM data with practical visitor information
const CURATED = [
  // Sossusvlei / Sesriem
  { n:'Dune 45', la:-24.7281, lo:15.9516, t:'viewpoint', d:'Climb before 7am, 45km from Sesriem gate on C27 (free with park entry)' },
  { n:'Dead Vlei', la:-24.7578, lo:15.9117, t:'viewpoint', d:'Ancient camel thorn trees in white clay pan, 1km walk from 4x4 parking' },
  { n:'Big Daddy Dune', la:-24.7613, lo:15.9142, t:'viewpoint', d:'325m climb, 2hr return, bring 2L water minimum' },
  { n:'Sesriem Canyon', la:-24.5454, lo:15.7649, t:'gorge', d:'30m deep gorge carved by the Tsauchab River, 1km loop walk at sunset' },
  { n:'Elim Dune', la:-24.5630, lo:15.7734, t:'viewpoint', d:'Accessible dune 5km from gate, half the crowds of Dune 45' },
  { n:'Hidden Vlei', la:-24.7530, lo:15.9010, t:'viewpoint', d:'Far fewer people than Deadvlei, 2.5km through the pans' },
  // Etosha
  { n:'Okaukuejo Waterhole', la:-19.1481, lo:15.9121, t:'wildlife_hide', d:'Floodlit at night — lion, rhino and elephant regularly, stay past 10pm' },
  { n:'Halali Waterhole', la:-19.0340, lo:16.4580, t:'wildlife_hide', d:'Elephant herds arrive in the late afternoon daily, 4–6pm' },
  { n:'Namutoni Fort', la:-18.8063, lo:16.9437, t:'fort', d:'Beautiful restored German colonial fort at eastern gate, sunrise photography' },
  { n:'Fischer\'s Pan', la:-18.5490, lo:16.4620, t:'viewpoint', d:'Seasonal flamingos — thousands of pink flamingos on flooded pan' },
  { n:'Dolomite Camp Area', la:-19.2530, lo:14.9750, t:'viewpoint', d:'Lion and cheetah territory in remote western Etosha, self-drive loop' },
  // Swakopmund / Walvis Bay
  { n:'Sandwich Harbour', la:-23.3630, lo:14.5120, t:'viewpoint', d:'Dunes drop into the Atlantic Ocean, 4x4 essential — Levo Expeditions (levotouring.com)' },
  { n:'Cape Cross Seal Colony', la:-21.7793, lo:13.9530, t:'nature_reserve', d:'100,000+ Cape fur seals, 120km north of Swakopmund' },
  { n:'Mondesa Township', la:-22.6580, lo:14.5230, t:'attraction', d:'Township tour — Tommy\'s Tour Operator (+264 64 403 123), authentic and insightful' },
  { n:'Walvis Bay Lagoon', la:-22.9570, lo:14.5040, t:'nature_reserve', d:'Thousands of pink flamingos year-round at the salt works — boat tour from R450' },
  { n:'Dune 7', la:-22.9930, lo:14.5580, t:'viewpoint', d:'Highest accessible dune near Walvis Bay, sandboarding, free entry' },
  // Fish River Canyon
  { n:'Fish River Canyon', la:-27.6421, lo:17.6062, t:'gorge', d:'549m deep, second largest canyon in the world — sunrise at Hobas lookout by 6:30am' },
  { n:'Ai-Ais Hot Springs', la:-27.9814, lo:17.5913, t:'hot_spring', d:'60°C thermal pools (+264 63 297 011, R150/person)' },
  { n:'Hell\'s Corner Viewpoint', la:-27.5870, lo:17.5340, t:'viewpoint', d:'Dramatic canyon rim views, 4x4 track along the Fish River Canyon edge' },
  // Lüderitz
  { n:'Kolmanskop Ghost Town', la:-26.7043, lo:15.2284, t:'ruins', d:'Diamond-rush ruins buried in sand, guided tour 08:30 & 10:00, R220/person' },
  { n:'Diaz Point Lighthouse', la:-26.6513, lo:15.0337, t:'viewpoint', d:'Jackass penguin colony and flamingos, 20km south of Lüderitz' },
  { n:'Halifax Island', la:-26.6780, lo:15.0530, t:'viewpoint', d:'Largest African penguin colony in Namibia, viewed from mainland shore' },
  // Spitzkoppe
  { n:'Spitzkoppe', la:-21.8336, lo:15.1744, t:'peak', d:'1,728m granite inselberg — guided summit hike, San rock art at Bushman\'s Paradise (R150)' },
  { n:'Pontok Mountains', la:-21.8500, lo:15.2100, t:'peak', d:'Lesser-visited granite domes east of Spitzkoppe, superb sunrise light' },
  // Skeleton Coast
  { n:'Eduard Bohlen Shipwreck', la:-26.4770, lo:15.0000, t:'wreck', d:'Stranded 500m inland since 1909, accessible by 4x4 from Conception Bay' },
  { n:'Torra Bay Campsite', la:-20.8920, lo:13.4690, t:'viewpoint', d:'Surf fishing — kabeljou, steenbras and galjoen from the beach' },
  // Damaraland
  { n:'Twyfelfontein Rock Engravings', la:-20.5986, lo:14.3736, t:'archaeological_site', d:'UNESCO World Heritage, 6,000+ petroglyphs, guided tour R200' },
  { n:'Burnt Mountain', la:-20.5870, lo:14.3590, t:'viewpoint', d:'Otherworldly volcanic rock in vivid reds, blacks and purples' },
  { n:'Brandberg Mountain', la:-21.1564, lo:14.5333, t:'peak', d:'Highest in Namibia (2,573m) — White Lady rock painting, guide compulsory' },
  { n:'Petrified Forest Damaraland', la:-20.9800, lo:13.9800, t:'archaeological_site', d:'260-million-year-old fossilised logs lying in open desert' },
  // Windhoek
  { n:'Christuskirche Windhoek', la:-22.5662, lo:17.0836, t:'monument', d:'Iconic German Lutheran church, free to visit, colonial architecture walk' },
  { n:'Namibia Craft Centre', la:-22.5590, lo:17.0810, t:'attraction', d:'Best curated local crafts (40 Tal Street), open Mon–Sat' },
  { n:'Daan Viljoen Game Reserve', la:-22.5330, lo:16.9000, t:'nature_reserve', d:'20min from city centre, self-drive kudu and zebra' },
  // Caprivi / Bwabwata
  { n:'Popa Falls', la:-18.0760, lo:21.6850, t:'waterfall', d:'Okavango rapids, 45min west of Divundu, hippo pools below the falls' },
  { n:'Bwabwata National Park', la:-18.3000, lo:21.8500, t:'nature_reserve', d:'Buffalo, elephant, hippo and lion territory — self-drive' },
  // Rundu / Kavango
  { n:'Okavango River Rundu', la:-17.9290, lo:19.7680, t:'attraction', d:'Sundowner boat cruise, hippo pods near Sarasungu river lodge' },
  // Victoria Falls
  { n:'Victoria Falls', la:-17.9243, lo:25.8567, t:'waterfall', d:'One of the world\'s largest waterfalls — Rainforest Trail Zimbabwe side, R400/person' },
  { n:'Victoria Falls Bridge', la:-17.9314, lo:25.8571, t:'attraction', d:'111m bungee jump (Shearwater +263 13 40006, R3500) and gorge swing' },
  { n:'Batoka Gorge', la:-17.9400, lo:25.8650, t:'gorge', d:'Grade 5 white water rafting — Shearwater or Wildside, full day R2000/person' },
  { n:'Devil\'s Pool', la:-17.9242, lo:25.8549, t:'viewpoint', d:'Swim on the edge of the falls — Zambia side, Sep–Dec only' },
  // Okavango / Botswana
  { n:'Okavango Delta', la:-19.3021, lo:22.8475, t:'nature_reserve', d:'Mokoro trip through lily pads and papyrus — book through Maun operators' },
  { n:'Moremi Game Reserve', la:-19.1670, lo:23.4500, t:'nature_reserve', d:'Wild dog dens on Chief\'s Island — 4x4 self-drive, best Oct–Apr' },
  { n:'Nxai Pan', la:-20.0450, lo:24.8510, t:'nature_reserve', d:'Meerkats at dawn — guide meets you at 5:30am, habituated groups' },
  { n:'Makgadikgadi Salt Pans', la:-20.6080, lo:25.2350, t:'viewpoint', d:'Flat white expanse to horizon — quad bikes with Planet Baobab' },
  { n:'Chobe River', la:-17.7950, lo:25.1650, t:'nature_reserve', d:'Sunset boat cruise — elephant herds swimming, from R850/person at Kasane' },
  { n:'Chobe National Park', la:-18.0500, lo:24.5000, t:'nature_reserve', d:'Largest elephant population in Africa — 4x4 self-drive from Kasane gate' },
  // Cape Town / Western Cape
  { n:'Table Mountain', la:-33.9562, lo:18.4101, t:'peak', d:'Cable car (tablemountain.net) — book online, go early to beat queues' },
  { n:'Cape Point', la:-34.3573, lo:18.4979, t:'viewpoint', d:'Southern tip of Cape Peninsula — funicular R75, dramatic ocean cliffs' },
  { n:'Boulders Beach', la:-34.1960, lo:18.4516, t:'attraction', d:'African penguins at eye level — R210/person (sanparks.org)' },
  { n:'Chapman\'s Peak', la:-34.0960, lo:18.3690, t:'viewpoint', d:'9km cliff drive, R50 toll — best sunset route in the Cape' },
  { n:'Signal Hill', la:-33.9120, lo:18.3970, t:'viewpoint', d:'Full moon hike — incredible city lights, go with a group' },
  // Garden Route
  { n:'Bloukrans Bridge', la:-33.9680, lo:23.6530, t:'attraction', d:'216m world\'s highest commercial bungee jump (R1250, facevolunteers.com)' },
  { n:'Tsitsikamma Suspension Bridge', la:-33.9880, lo:23.9110, t:'attraction', d:'77m above Storms River mouth — 1hr walk return through indigenous forest' },
  { n:'Knysna Heads', la:-34.0780, lo:23.0620, t:'viewpoint', d:'Dramatic estuary entrance between sandstone cliffs — boat trip recommended' },
  // Hermanus
  { n:'Hermanus Cliff Path', la:-34.4180, lo:19.2380, t:'viewpoint', d:'12km path along cliff, best Aug–Nov for Southern Right whales' },
  { n:'Hemel-en-Aarde Valley', la:-34.4080, lo:19.1620, t:'attraction', d:'Hamilton Russell Vineyards, 19km from Hermanus, pinot noir and chardonnay' },
  // Augrabies
  { n:'Augrabies Falls', la:-28.5963, lo:20.3382, t:'waterfall', d:'Orange River drops 56m into an 18km gorge (free with park entry)' },
  { n:'Augrabies Dassie Trail', la:-28.5950, lo:20.3420, t:'attraction', d:'58km 4x4 scenic circuit, permit from reception R220/vehicle' },
  // Kgalagadi
  { n:'Kgalagadi Transfrontier Park', la:-25.6190, lo:20.5430, t:'nature_reserve', d:'Red Kalahari dunes — lion, cheetah and black-maned lion territory' },
  { n:'Twee Rivieren Gate', la:-26.4640, lo:20.6180, t:'viewpoint', d:'Dawn lion tracking — pride of 8+ patrols the Nossob riverbed' },
  { n:'Mata Mata Gate', la:-24.8540, lo:19.7770, t:'viewpoint', d:'Gemsbok herds at Rooiputs waterhole — hundreds in dry season (Aug–Oct)' },
  // Kruger
  { n:'Satara Camp', la:-24.3960, lo:31.7790, t:'attraction', d:'Best lion and big cat territory in Kruger — dawn drive along H1-4' },
  { n:'Lower Sabie Camp', la:-25.1140, lo:31.9140, t:'wildlife_hide', d:'Morning hippo counts at S114 causeway — resident pod' },
  { n:'Olifants River Viewpoint', la:-23.8510, lo:31.7200, t:'viewpoint', d:'Panoramic hippo and elephant view from the deck — bring binoculars' },
  { n:'Letaba Elephant Museum', la:-23.8510, lo:31.5800, t:'museum', d:'Skulls of the Magnificent Seven tuskers — free with camp entry' },
  { n:'Berg-en-Dal White Rhino', la:-25.4310, lo:31.4500, t:'nature_reserve', d:'Highest white rhino concentration in southern Kruger — dawn drive' },
  // Hluhluwe / iSimangaliso
  { n:'Hluhluwe-iMfolozi Park', la:-28.0270, lo:31.8840, t:'nature_reserve', d:'White rhino tracking on foot — wilderness trails, book well in advance' },
  { n:'St Lucia Estuary', la:-28.3760, lo:32.4150, t:'nature_reserve', d:'Hippo and croc boat cruise — R170/person, departs 8:30am' },
  { n:'Sodwana Bay', la:-27.5300, lo:32.6920, t:'attraction', d:'Mozambique border zone coral reef diving — pristine reefs 1hr north' },
  // Drakensberg
  { n:'Amphitheatre', la:-28.7470, lo:29.1910, t:'viewpoint', d:'Base of Tugela Falls (second highest waterfall) — 4hr return from Sentinel car park' },
  { n:'Cathedral Peak', la:-28.9520, lo:29.2410, t:'peak', d:'7hr return hike, requires fitness — panoramic Drakensberg views' },
  { n:'Tugela Falls', la:-28.7400, lo:29.2000, t:'waterfall', d:'Second highest waterfall in the world — best seen after good rains' },
  { n:'Royal Natal National Park', la:-28.6720, lo:28.9700, t:'nature_reserve', d:'Thendele Camp cliff-edge sundowner — book dinner at camp ahead' },
  // Richtersveld
  { n:'Richtersveld Transfrontier Park', la:-28.2500, lo:17.1500, t:'nature_reserve', d:'Black-rated 4x4 tracks, permit from SANParks — most remote park in SA' },
  { n:'Sendelingsdrift Pontoon', la:-28.3670, lo:17.1580, t:'attraction', d:'Cross the Orange River to Namibia on a floating pontoon' },
  // Cederberg
  { n:'Wolfberg Arch', la:-32.6050, lo:19.3280, t:'arch', d:'4hr return hike to iconic quartzite arch — permit via CapeNature' },
  { n:'Wolfberg Cracks', la:-32.6070, lo:19.3260, t:'arch', d:'Narrow slot canyon scramble — adventurous 2hr route' },
  // Pilanesberg
  { n:'Pilanesberg National Park', la:-25.2500, lo:27.0500, t:'nature_reserve', d:'Big 5 in an extinct volcano crater — 3hr drive from Johannesburg' },
  { n:'Mankwe Dam', la:-25.2520, lo:27.0280, t:'wildlife_hide', d:'Resident lion pride drinks here regularly — best at dawn' },
  // Johannesburg
  { n:'Apartheid Museum', la:-26.2530, lo:27.9920, t:'museum', d:'Half-day minimum, deeply moving — R195/person (apartheidmuseum.org)' },
  { n:'Constitution Hill', la:-26.1912, lo:28.0444, t:'monument', d:'Old Fort prison — R85/person, powerful history of the struggle era' },
  { n:'Cradle of Humankind', la:-26.0000, lo:27.7700, t:'archaeological_site', d:'Sterkfontein Caves tours, UNESCO site — 1hr northwest of Johannesburg' },
  // Mozambique
  { n:'Bazaruto Archipelago', la:-21.7000, lo:35.5000, t:'nature_reserve', d:'Pristine coral gardens, dugong snorkelling — dhow day trip from Vilanculos' },
  { n:'Gorongosa National Park', la:-18.9500, lo:34.3500, t:'nature_reserve', d:'Remarkable wildlife recovery story — lion, elephant, buffalo and hippo' },
  // Zambia / Zimbabwe
  { n:'Lower Zambezi National Park', la:-15.7000, lo:29.5000, t:'nature_reserve', d:'Canoeing safari on the Zambezi — elephant and buffalo on the banks' },
  { n:'South Luangwa National Park', la:-13.1000, lo:31.7000, t:'nature_reserve', d:'Walking safaris — birthplace of the guided bush walk in Africa' },
  { n:'Hwange National Park', la:-19.0000, lo:26.4000, t:'nature_reserve', d:'Largest elephant population in Zimbabwe — 40,000+ animals at dry season waterholes' },
  { n:'Matobo Hills', la:-20.4800, lo:28.4500, t:'archaeological_site', d:'San rock art, black & white rhino tracking on foot — Cecil Rhodes\' grave' },
  // Eswatini / Lesotho
  { n:'Mlilwane Wildlife Sanctuary', la:-26.4890, lo:31.1370, t:'nature_reserve', d:'Cycle or horse through hippo territory — unique Swaziland experience' },
  { n:'Sani Pass', la:-29.5800, lo:29.2700, t:'viewpoint', d:'Highest pass in southern Africa (2,874m) — 4x4 essential, Lesotho border crossing' },
];

const DEDUP_M = 200;       // merge duplicates within 200m
const DELAY_MS = 4000;     // wait between country queries
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function haversineM(la1, lo1, la2, lo2) {
  const R = 6371000, d1 = (la2-la1)*Math.PI/180, d2 = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(d1/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(d2/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildQuery(countryName) {
  return `[out:json][timeout:120];
area["name"="${countryName}"]["admin_level"="2"]->.c;
(
  node["tourism"~"^(attraction|viewpoint|museum|zoo|aquarium|artwork|gallery|theme_park|information)$"](area.c);
  node["historic"~"^(monument|ruins|archaeological_site|memorial|castle|fort|wreck|battlefield|mine)$"](area.c);
  node["natural"~"^(peak|waterfall|hot_spring|cave_entrance|arch|beach|bay|cape|gorge|dune|rock|volcano|spring)$"](area.c);
  node["leisure"~"^(nature_reserve|park|wildlife_hide)$"](area.c);
  way["tourism"~"^(attraction|viewpoint|museum|zoo|aquarium|gallery)$"](area.c);
  way["historic"~"^(monument|ruins|archaeological_site|memorial|castle|fort|wreck)$"](area.c);
  way["natural"~"^(peak|waterfall|cave_entrance|arch|gorge|nature_reserve)$"](area.c);
  way["leisure"~"^(nature_reserve|park)$"](area.c);
  relation["leisure"~"^(nature_reserve|park)$"](area.c);
  relation["boundary"="national_park"](area.c);
  relation["boundary"="protected_area"](area.c);
);
out center tags;`;
}

const BAD_NAME = /^(unnamed|unknown|yes|no|\d+)$/i;
const SKIP_WORDS = /\b(street|road|avenue|drive|lane|way|place|suburb|township|ward|block|plot|stand|unit|floor|shop|store|outlet|branch|church|school|clinic|hospital|pharmacy|bank|atm|petrol|garage|supermarket|mall|centre|center)\b/i;

function parseElement(el, countryCode) {
  const name = (el.tags?.name || '').trim();
  if (!name || name.length < 3 || BAD_NAME.test(name)) return null;
  if (SKIP_WORDS.test(name)) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const tags = el.tags || {};
  let typeRaw = tags.tourism || tags.historic || tags.natural || tags.leisure;

  // Handle national park relations
  if (!typeRaw && (tags.boundary === 'national_park' || tags.boundary === 'protected_area')) {
    typeRaw = 'park';
  }

  if (!typeRaw || !TYPE_LABEL[typeRaw]) return null;

  return {
    n: name,
    la: Math.round(lat * 10000) / 10000,
    lo: Math.round(lon * 10000) / 10000,
    t: typeRaw,
    c: countryCode,
  };
}

async function fetchCountry(country, attempt = 1) {
  const query = buildQuery(country.name);
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(130000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 100)}`);
  }

  const data = await resp.json();
  const results = [];
  for (const el of data.elements || []) {
    const parsed = parseElement(el, country.code);
    if (parsed) results.push(parsed);
  }
  return results;
}

function deduplicate(items) {
  const out = [];
  for (const a of items) {
    let found = false;
    for (const b of out) {
      if (a.n.toLowerCase() === b.n.toLowerCase() &&
          haversineM(a.la, a.lo, b.la, b.lo) < DEDUP_M) {
        // Prefer curated entries (have .d description)
        if (a.d && !b.d) Object.assign(b, a);
        found = true;
        break;
      }
    }
    if (!found) out.push({ ...a });
  }
  return out;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TREK Attractions Database Builder');
  console.log('═══════════════════════════════════════════════════════\n');

  // Start with curated entries
  const all = CURATED.map(a => ({ ...a }));
  console.log(`Curated entries: ${all.length}\n`);

  const stats = {};

  for (let i = 0; i < COUNTRIES.length; i++) {
    const country = COUNTRIES[i];
    process.stdout.write(`[${i+1}/${COUNTRIES.length}] ${country.name}... `);

    let results = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        results = await fetchCountry(country, attempt);
        break;
      } catch (e) {
        if (attempt < 3) {
          process.stdout.write(`(retry ${attempt}/3 after 15s) `);
          await sleep(15000);
        } else {
          console.log(`FAILED after 3 attempts: ${e.message}`);
        }
      }
    }

    stats[country.code] = results.length;
    console.log(`${results.length} entries`);
    all.push(...results);

    if (i < COUNTRIES.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nRaw total: ${all.length}`);
  const deduped = deduplicate(all);
  console.log(`After dedup: ${deduped.length}`);

  // Sort by country then name
  deduped.sort((a, b) => {
    if (a.c !== b.c) return (a.c || '').localeCompare(b.c || '');
    return a.n.localeCompare(b.n);
  });

  const output = {
    v: 1,
    generated: new Date().toISOString().slice(0, 10),
    count: deduped.length,
    stats,
    attractions: deduped,
  };

  const outPath = path.join(__dirname, '..', 'attractions.json');
  const json = JSON.stringify(output);
  fs.writeFileSync(outPath, json);

  const sizeKB = Math.round(json.length / 1024);
  console.log(`\n✓ Written: attractions.json (${sizeKB} KB, ${deduped.length} attractions)`);
  console.log('\nCountry breakdown:');
  for (const [code, count] of Object.entries(stats)) {
    const country = COUNTRIES.find(c => c.code === code);
    console.log(`  ${code} ${country?.name || ''}: ${count}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
