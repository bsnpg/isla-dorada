// Isla Dorada: all the game's data in one place — missions, districts, landmarks,
// weapons, skills, properties, characters and tuning. Nothing here draws anything;
// the systems read these tables and build the world from them.
export const CITY_SIZE = 420;
export const ROAD_STEP = 60;
export const ROAD_WIDTH = 14;

export const MISSIONS = [
  { id: 1, name: 'Pendaratan', en: 'Landing', payout: 2500, stages: ['Reach Casino Dorada', 'Drive the getaway route', 'Escape the IDPD'], desc: 'Wowo lands on Isla Dorada and takes his first driving job for the casino.' },
  { id: 2, name: 'Cari Saksi', en: 'Find the Witness', payout: 4000, stages: ['Reach the Old Town', 'Find the witness in the market', 'Escape with the witness'], desc: 'A witness in the Old Town can clear Wowo. Find her before the IDPD does.' },
  { id: 3, name: 'Curi Bukti', en: 'Steal the Evidence', payout: 6000, stages: ['Reach the guarded archive', 'Take the evidence files', 'Escape the Harbor'], desc: 'The evidence that frames Wowo sits in a guarded building by the Harbor.' },
  { id: 4, name: 'Causeway Chase', en: 'Causeway Chase', payout: 8000, stages: ['Reach the Causeway toll', 'Survive the 150-second chase', 'Break the roadblock'], desc: 'A 150-second chase across the Causeway with the IDPD closing in.' },
  { id: 5, name: 'Gudang Senjata', en: 'Weapons Warehouse', payout: 10000, stages: ['Reach the warehouse', 'Raid the weapons cache', 'Escape with the arsenal'], desc: 'Raid the weapons warehouse and arm the crew for what comes next.' },
  { id: 6, name: 'Konfrontasi', en: 'Confrontation', payout: 12000, stages: ['Reach the hill villa', 'Confront the man who framed you', 'Escape the villa guards'], desc: 'Face the man who framed Wowo, high above the city in the Hills.' },
  { id: 7, name: 'Bukti Terakhir', en: 'The Last Evidence', payout: 15000, stages: ['Reach the police archive', 'Recover the last evidence', 'Escape HQ'], desc: 'One last piece of evidence, inside IDPD headquarters itself.' },
  { id: 8, name: 'Bebas', en: 'Free', payout: 25000, stages: ['Reach the marina', 'Board the escape boat', 'Five-star escape off the island'], desc: 'The final five-star escape off Isla Dorada. Clear his name, or disappear trying.' },
];

export const DISTRICTS = [
  { name: 'Beachfront', color: '#f2c94c', desc: 'Gold sand and palms' },
  { name: 'Casino Row', color: '#e5539e', desc: 'Neon and glass' },
  { name: 'Marina', color: '#3fa7d6', desc: 'Boats and blue water' },
  { name: 'Old Town', color: '#d98e4a', desc: 'Warm stone and shutters' },
  { name: 'Harbor', color: '#7a8a99', desc: 'Cranes and containers' },
  { name: 'Causeway', color: '#8e6cc8', desc: 'The long bridge road' },
  { name: 'Hills', color: '#5da85d', desc: 'Green slopes and villas' },
];

export const LANDMARKS = [
  { name: 'Casino Dorada', district: 'Casino Row', x: 30, z: -30 },
  { name: 'Marina', district: 'Marina', x: -120, z: 60 },
  { name: 'Lighthouse', district: 'Beachfront', x: -180, z: 150 },
  { name: 'Old Market', district: 'Old Town', x: 90, z: 90 },
  { name: 'Warehouse', district: 'Harbor', x: 150, z: -120 },
  { name: 'IDPD HQ', district: 'Harbor', x: 120, z: -60 },
  { name: 'Garage', district: 'Old Town', x: 60, z: 120 },
  { name: 'Beach', district: 'Beachfront', x: -150, z: 180 },
  { name: 'Hotel Row', district: 'Beachfront', x: -90, z: 150 },
  { name: 'Old Church', district: 'Old Town', x: 120, z: 60 },
  { name: 'Container Yard', district: 'Harbor', x: 180, z: -150 },
  { name: 'Causeway Toll', district: 'Causeway', x: 0, z: -180 },
  { name: 'Hill Villa', district: 'Hills', x: 150, z: 150 },
];

export const WEAPONS = [
  { name: 'Fists', key: '1', ammo: '∞', reserve: '', melee: true, damage: 25, color: '#e8e0d0' },
  { name: 'Pistol', key: '2', ammo: 12, reserve: 96, damage: 34, color: '#c9ced6' },
  { name: 'SMG', key: '3', ammo: 32, reserve: 160, damage: 22, color: '#f2c94c' },
  { name: 'Shotgun', key: '4', ammo: 6, reserve: 36, damage: 65, color: '#d98e4a' },
  { name: 'Rifle', key: '5', ammo: 30, reserve: 120, damage: 48, color: '#7fb069' },
  { name: 'Bazooka', key: '6', ammo: 1, reserve: 6, damage: 300, color: '#e5534b' },
];

export const SKILLS = [
  { name: 'Driving', level: 7, max: 10 },
  { name: 'Aim', level: 6, max: 10 },
  { name: 'Influence', level: 5, max: 10 },
  { name: 'Stamina', level: 6, max: 10 },
  { name: 'Stealth', level: 4, max: 10 },
  { name: 'Street Sense', level: 8, max: 10 },
];

export const PROPERTIES = [
  { name: 'Marina Boathouse', owned: true, income: 1200 },
  { name: 'Casino Row Apartment', owned: false, price: 45000 },
  { name: 'Old Town Shophouse', owned: false, price: 28000 },
];

export const GARAGE_UPGRADES = [
  { name: 'Engine', level: 3, max: 5, cost: 4000 },
  { name: 'Armor', level: 2, max: 5, cost: 3500 },
  { name: 'Brakes', level: 3, max: 5, cost: 2500 },
  { name: 'Nitro', level: 4, max: 5, cost: 5000 },
  { name: 'Paint', level: 2, max: 5, cost: 1500 },
];

export const CHARACTERS = [
  { name: 'Wowo', role: 'Ex-Sergeant · Getaway Driver', color: '#f2a541', initial: 'W', line: '"I did not do it. I will prove it — one job at a time."' },
  { name: 'Madame Rosa', role: 'Owner · Casino Dorada', color: '#e5539e', initial: 'R', line: '"Drive for me, Wowo, and the island owes you."' },
  { name: 'Kiko', role: 'Informant · Old Town', color: '#3fa7d6', initial: 'K', line: '"The witness hides in the market. Go before they do."' },
  { name: 'Captain Varga', role: 'IDPD · Captain', color: '#5b7fa6', initial: 'V', line: '"Wowo, the whole island is looking for you."' },
  { name: 'Bengkel Joe', role: 'Mechanic · Garage', color: '#d98e4a', initial: 'J', line: '"Your Aurea GT is ready. Treat her gently. Or do not."' },
  { name: 'Sable', role: 'Rival Driver', color: '#8e6cc8', initial: 'S', line: '"Fastest driver on Isla Dorada? We will see."' },
];

export const IDOL_COUNT = 20;
export const START_MONEY = 48250;
export const START_COMPLETION = 63;
export const START_JOB = 5;

export const TUNING = {
  topSpeedKmh: 182,
  chaseSpeedKmh: 112,
  nitroBoost: 1.45,
  walkSpeed: 7,
  runSpeed: 11,
  jetpackSpeed: 16,
  carAccel: 26,
  carBrake: 42,
  carTurn: 1.9,
  wantedDecaySeconds: 45,
  causewayChaseSeconds: 150,
};

export const RADIO_STATION = 'RADIO SOL 92.5';
export const DIALOGUE = [
  'Wowo: "One more job. Then my name is clean."',
  'Kiko: "The witness is in the market — hurry."',
  'Madame Rosa: "The casino always pays its drivers."',
  'Captain Varga: "All units, Wowo is on the move."',
  'Bengkel Joe: "Nitro is topped up. Go fast, come back safe."',
];
