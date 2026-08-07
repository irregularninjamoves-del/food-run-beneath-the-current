# Food Run: Beneath the Current

A colorful 2D underwater stealth, gathering, crafting, and extraction game for desktop and mobile browsers.

You play a vulnerable reef fish. Swim into procedurally generated water, gather food and ocean salvage, read predator awareness, use seaweed as cover, survive environmental obstacles, and return home before losing the haul.

## Features

- Momentum-based swimming and stamina-limited burst movement
- Keyboard and responsive touch controls
- Three ocean zones — Shallow Reef, Kelp Forest, and Deep Water — with escalating danger and food value
- Two playable fish: the Swift Fish (fast, quick recovery, light bag) and the Forager Fish (slow, wide reach, heavy hauls with bonus deliveries)
- Two schools to feed: Sunbeam Shoal at the home reef and Midnight Shoal far out in deep water — deliver your haul to whichever you reach
- School levels grow the population on screen and unlock real perks (extra decoys, stamina, hearts, richer rare food, faster sonar, cheaper bursts)
- Common, uncommon, and rare food tiers; rare glowfruit clusters near predator territory
- Spendable noncombat talents across stealth, gathering, and voyage currents
- Minion, lieutenant, and boss awareness radii with readable alert warnings
- Seaweed stealth, sonar, decoys, and whale assistance
- Jellyfish, partial fishing nets, vents, currents, and day/night changes
- Floating reward numbers and delivery celebrations
- Deterministic procedural chunks with bounded recycling
- Local saved progression
- Looping reef, exploration, and danger music with one-shot creature effects

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
