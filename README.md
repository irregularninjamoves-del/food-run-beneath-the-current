# Food Run: Beneath the Current

A colorful 2D underwater stealth, gathering, crafting, and extraction game for desktop and mobile browsers.

You play a vulnerable reef fish. Swim into procedurally generated water, gather food and ocean salvage, read predator awareness, use seaweed as cover, survive environmental obstacles, and return home before losing the haul.

## Features

- Momentum-based swimming and stamina-limited burst movement
- Keyboard and responsive touch controls
- Three ocean zones — Shallow Reef, Kelp Forest, and Deep Water — with escalating danger and food value
- Two playable fish: the Swift Fish (fast, quick recovery, light bag) and the Forager Fish (slow, wide reach, heavy hauls with bonus deliveries)
- Four schools spaced a true five miles apart — Sunbeam (home reef), Riptide (5 miles, speed), Midnight (10 miles, survival), and Umbra (15 miles, stealth) — each a longer voyage than the last
- You can only support three of the four; only supported schools grant perks, so the far shoals are a real trade
- Reaching an uncharted school triggers a NEW SCHOOL DISCOVERED moment and adopts them if you have a free slot
- Schools eat four meals a day: four keeps them well fed (+1% Reef Tokens), three is neutral, and fewer costs tokens, swim speed, and stamina until you bring more food
- Schools build upward as they grow — a Coral Hut at level 25, a Coral Tower at 50, and a Coral Spire at 100, raised from sand and coral with residents watching from the windows
- Reef Tokens: a slow currency earned by showing up — a 7-day check-in streak pays 1 token on day 1 up to 7 on day 7 (missing a day resets it), and after checking in every hour of actual play earns 0.1 more, scaled by boosts and how well your schools are fed; nothing accrues while idle
- Reef Boosts: spend tokens on +10% school-growth-and-token windows from 5 minutes to 24 hours; buying more time stacks
- A Reef Token store of rarity-tiered fish skins and school themes — cosmetic only, never power
- Lifetime distance records with in-run "NEW DISTANCE RECORD!" callouts and six modular distance achievements that survive defeat
- A living ocean: ambient fish schools drift everywhere and scatter from predators, warning you before you see the danger
- School levels grow the population on screen and unlock real perks (extra decoys, stamina, hearts, richer rare food, faster sonar, cheaper bursts)
- Common, uncommon, and rare food tiers; rare glowfruit clusters near predator territory
- Spendable noncombat talents across stealth, gathering, voyage, and bubble-craft currents
- Bubble decoys fire as projectiles that pop loudly where they land, luring minions and (briefly) lieutenants — never bosses
- Choose exactly one bubble craft: Stun Pop, Slumber Mist, or a Guardian Illusion that scares minions
- Hunters slowly wise up to repeated pops — smarter tiers stop falling for them sooner
- Deep water hides glowing bubble pearls that refill a decoy and supercharge the next pop
- Level-5 schools empower your craft: Sunbeam widens the pop, Midnight extends its effects
- A two-step Reset Progress option on the title screen starts the journey over
- Touch controls include sonar and decoy buttons alongside the thumbstick, burst, and interact
- Minion, lieutenant, and boss awareness radii with readable alert warnings
- Seaweed stealth, sonar, decoys, and whale assistance
- Jellyfish, partial fishing nets, vents, currents, and day/night changes
- Floating reward numbers and delivery celebrations
- Deterministic procedural chunks with bounded recycling
- Local saved progression
- Distinct looks for each playable fish: the slim coral Swift Fish and the plump teal Forager Fish
- Looping reef, exploration, chase, and boss-battle music over a constant underwater-ambience bed, with one-shot creature effects

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev:next
```

Open `http://localhost:3000`.

## Controls

- `WASD` or arrow keys: swim
- `Shift` or `Space`: burst
- `E`: interact, hide, accept help, or extract
- `F`: sonar
- `Q`: bubble decoy
- `Tab`: bag
- `Escape`: pause and accessibility settings

Phones and tablets receive an on-screen directional pad, BURST button, and interaction button automatically.

## Deploy to Vercel

1. Import this repository in Vercel.
2. Keep the detected framework as **Next.js**.
3. Deploy. `vercel.json` selects `npm run build:next` automatically.

## Deploy to Netlify

1. Import this repository in Netlify.
2. Netlify reads `netlify.toml` and runs `npm run build:next`.
3. Deploy with the Next.js runtime enabled by Netlify.

## Other builds

- `npm run build:next`: portable Next.js build for Vercel or Netlify
- `npm run build`: vinext/Cloudflare build used by OpenAI Sites
- `npx tsx --test tests/game-systems.test.ts`: gameplay-system tests

## Current prototype scope

The prototype proves one loop: explore → risk → collect → return → feed → grow → upgrade → explore farther. Two fish types and two schools are intentional; each system is built deep rather than wide. Talents focus on stealth, gathering, and voyaging — the design deliberately avoids weapons so the fish remains vulnerable throughout progression.
