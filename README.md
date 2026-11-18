# Isla Dorada: 8 Jobs to Clear His Name

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bsnpg/isla-dorada/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bsnpg/isla-dorada/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game set on Isla Dorada, a sun-soaked island of resorts, a casino row, a marina and a harbor. You play **Wowo**, an ex-Sergeant dishonorably discharged from the army, who came to the island to disappear — and ended up the most wanted getaway driver on it. Across **8 staged story jobs** he steals cars, outruns the IDPD, fights rival crews and gathers the evidence to clear his name, one job at a time, until the final five-star escape off the island.

Built with three.js (vendored locally, no network, no build step) for make.fun's "Make GTA 6" bounty (gta6-01). All names, places, vehicles, characters and radio stations are original.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No install, no build step, no network: `serve.ts` (Node 22, standard library only) serves `game/` on port 8080. Desktop Chrome, keyboard + mouse. Deterministic staged screenshots: `?shot=chase|title|combat|map&seed=1` (see `shots.json`).

## The 8 jobs

| # | Job | Objective |
|---|-----|-----------|
| 1 | Pendaratan | Drive the casino boss to Casino Dorada |
| 2 | Cari Saksi | Pick up the witness, lose the police tail |
| 3 | Curi Bukti | Steal the evidence from the police impound |
| 4 | Kejar-kejaran Causeway | Deliver the evidence across the Causeway — outrun the IDPD |
| 5 | Gudang Senjata | Clear the warehouse, take the weapons cache |
| 6 | Konfrontasi | Confront Officer Braga at the Marina |
| 7 | Bukti Terakhir | Steal the recording from the IDPD station |
| 8 | Bebas | Escape Isla Dorada — wanted level 5, reach the Causeway |

## Controls

| Key | Action |
|-----|--------|
| W / A / S / D (or arrow keys) | Drive / move on foot |
| E | Enter or exit a car — walk up to any car and steal it |
| Space | Handbrake |
| Shift | Nitro boost (if bought in the garage) / sprint on foot |
| Mouse (click to aim) | Aim on foot; hold left mouse to fire |
| 1–4 | Weapon rack: Pistol, SMG, Shotgun, Rifle |
| R | Reload current weapon |
| M | Full city map |
| G | Garage (near the garage) |
| Esc | Pause |

## Systems shipped

- **Open world**: a 640 × 640 m island with 7 named districts (Beachfront, Casino Row, Old Town, Marina, Palm Heights, Harbor, Causeway), sunset lighting, beach and sea.
- **Driving**: 6 original vehicles (Aurea GT, Solano S, Palma Cruiser, Faro Pickup, Cayo Coupe, Marina Taxi), chase camera with speed FOV, ambient traffic cars and pedestrians.
- **Police**: wanted level 0–5 stars, named IDPD response units (UNIT 12, UNIT 07, UNIT 23, UNIT 31, HAWK-1, UNIT 18) with live statuses — PURSUIT, RAMMING, ROADBLOCK, BOXING IN, SEARCHLIGHT — plus the IDPD Hawk helicopter.
- **On-foot combat**: 4-weapon rack with ammo, reload, enemy AI that closes in and shoots back, tracers.
- **Missions**: 8 staged story jobs with briefings, objectives and escalating wanted levels, with Wowo's dialogue.
- **HUD**: mission panel with timer and next step, wanted stars, money, clock, police response list, round minimap with district name, health and armour, weapon rack, speed and vehicle name, radio readout.
- **Garage**: upgrades with prices — Turbo Engine, Armored Plating, Sport Brakes, Nitro Boost, Gold Paint Job.
- **Radio**: 3 procedural WebAudio stations (RADIO SOL 92.5, DORADA FM 101.3, PALMA 77.7), engine hum and police sirens — no audio files.
- **Save**: progress (mission, money, upgrades, stats, position, health, armour) saves to a local slot; the title screen offers CONTINUE — SAVE SLOT 1.
- **Title screen, full city map screen, and 4 staged screenshots** (`screenshots/`: chase, title, combat, map).

---

<sub>Entered on [make.fun](https://make.fun/?ref=26zqsqqz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
