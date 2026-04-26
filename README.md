# Lucky Spin Royale

A high-performance, mobile-first prize-wheel game built with **React + Vite + TypeScript**, animated with **Framer Motion**, styled with **Tailwind CSS v4**, and iconed with **Lucide React**.

The game connects to a **Google Apps Script** backend that handles login, the prize-wheel configuration, the spin result, and any restriction message.

## Features

- Physics-based spinning wheel with deceleration easing and a bouncing pointer
- Animated LED ring and pulsing radial halo around the wheel
- Synthesized Web Audio sound effects (spin start, segment ticks, win, jackpot) — no audio files needed
- Mute toggle in the header
- Per-student play history (last 20 spins) persisted to `localStorage`
- Stats strip showing spins, wins and net point change
- Confetti + Jackpot modal celebration
- Login + agreement modal + restriction overlay
- Compact, collapsible prize board
- Mobile-first layout (single column on phones, wheel + history side-by-side on desktop)

## Tech stack

| Layer       | Library                                 |
| ----------- | --------------------------------------- |
| Framework   | React 19 + Vite 7 + TypeScript          |
| Styling     | Tailwind CSS v4 (`@tailwindcss/vite`)   |
| Animation   | Framer Motion 12                        |
| Icons       | Lucide React                            |
| Sound       | Web Audio API (no external assets)      |
| Backend     | Google Apps Script (HTTP POST)          |
| Persistence | `localStorage` (per student ID)         |

## Quick start

```bash
# 1. Install dependencies (npm, pnpm or yarn — pick one)
npm install

# 2. Start the dev server (http://localhost:5173)
npm run dev

# 3. Build for production
npm run build

# 4. Preview the production build locally
npm run preview
```

## Backend endpoint

The Apps Script endpoint URL lives in `src/lib/api.ts` as the exported constant `ENDPOINT`. To point the game at a different backend, edit that one line.

The backend is expected to accept `multipart/form-data` POST requests and respond to four `action` values:

- `login` — `{ id, password }` → `{ success, message?, name?, points? }`
- `getSlotConfig` → `{ spinCost, prizes: [{ Emoji, PrizeName, RewardPoints }] }`
- `handleCardGame` — `{ id, password }` → `{ success, message?, emoji?, prize?, change?, remaining?, hitJackpot? }`
- `getRestrictionMessage` — `{ id }` → `{ message? }`

## Project structure

```
lucky-spin/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── favicon.svg
│   └── opengraph.jpg
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css            # Tailwind v4 theme + glass utilities
    ├── components/
    │   ├── Confetti.tsx
    │   ├── HistoryPanel.tsx
    │   └── SpinWheel.tsx
    ├── lib/
    │   ├── api.ts           # Apps Script client (ENDPOINT lives here)
    │   ├── history.ts       # localStorage-backed play history
    │   └── sound.ts         # Web Audio sound effects
    └── pages/
        └── LuckySpin.tsx    # Main game page
```

## Deploying

The `dist/` folder produced by `npm run build` is a fully static bundle. You can host it on any static host:

- **Vercel** — import the GitHub repo, framework preset “Vite”, build command `npm run build`, output `dist`
- **Netlify** — same as above
- **GitHub Pages** — push `dist/` to a `gh-pages` branch (set Vite `base` to `"/<repo>/"` first)
- **Cloudflare Pages** — build command `npm run build`, output directory `dist`

## License

MIT
