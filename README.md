# TV Tracker

A phone app for keeping track of where you are in the TV shows you watch. Search
for a show, add it, and every episode is listed with a checkbox — mark what you
have seen and the progress bars tell you how far in you are and how much is left.

Built with Expo (React Native) and TypeScript. Show and episode data comes from
[TVmaze](https://www.tvmaze.com/api), which is free and needs no API key. Your
progress is stored on the phone only.

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone (App Store / Play Store). `npm run
web` opens it in a browser instead, which is handy for a quick look but not the
real target.

To install it properly, with its own icon on the home screen, see
[INSTALL.md](INSTALL.md). On an iPhone the free route is `npm run deploy`
(Vercel) followed by Add to Home Screen in Safari — no Apple account needed.

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest
```

## Screens

| Route | What it does |
| --- | --- |
| `app/(tabs)/index.tsx` | My Shows — up-next card, per-show progress, one tap to mark the next episode |
| `app/(tabs)/browse.tsx` | Search TVmaze, plus what is on today; "Track" adds a show |
| `app/(tabs)/airing.tsx` | Aired-but-unwatched episodes and upcoming air dates, from tracked shows only (no network) |
| `app/(tabs)/you.tsx` | Totals — episodes watched, time watched, time left |
| `app/show/[id]/index.tsx` | Show detail — overall progress, per-season bars |
| `app/show/[id]/season/[season].tsx` | Episode checklist for one season |

## How progress works

The source of truth is a set of watched episode ids per show, so the checklist
and the progress bars can never disagree. Everything else is derived:

- **next up** — first unwatched episode in air order
- **waiting** — episodes that have aired and are still unwatched
- **set position** — "I am here" marks every episode before that one as watched,
  which is the fast way to start tracking a show you are already deep into

That logic lives in `src/model/progress.ts` as pure functions, covered by
`src/model/__tests__/progress.test.ts`.

## Layout

```
app/                     screens (expo-router file-based routes)
src/api/                 TVmaze client and response parsing
src/model/progress.ts    pure progress/season/position logic
src/store/library.tsx    tracked shows, persisted with AsyncStorage
src/components/          shared UI
src/theme.ts             the Night City palette
design/                  the design canvas the UI was built from
```

## Notes

- Episode lists are cached with each tracked show, so the app opens and counts
  progress offline; running shows refresh at most once a day.
- Specials (TVmaze gives them a null episode number) are left out of tracking.
- TVmaze has no "trending" endpoint, so Browse rests on today's schedule rather
  than a popularity list.
- The web build is a real PWA: `app/+html.tsx` carries the iOS install metadata
  and `public/sw.js` caches the shell so it opens offline. `EXPO_PUBLIC_TVMAZE_BASE`
  overrides the API host if a deployment ever needs to proxy it.
