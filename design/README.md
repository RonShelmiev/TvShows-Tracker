# Design

Working files for the TV show tracker screen designs.

Each `*.dc.html` file is one artboard (a phone screen, 390x844); `canvas.json`
lays them out on the shared canvas. `tv-show-tracker-screens.html` is the
generated canvas that gets published — it is rebuilt from the artboards, so
edit the artboards, not that file.

## Artboards

Direction "Night City" — the chosen direction (page 1 of the canvas), full flow:

- `Main.dc.html` — My Shows: up-next card, per-show progress bars, tap to mark watched
- `ShowDetail.dc.html` — show page: overall progress, per-season bars
- `Episodes.dc.html` — season episode checklist, tap to tick
- `Browse.dc.html` — search / trending / airing tonight

Earlier alternates for the My Shows screen (page 2, still in their original palette):

- `DirectionB.dc.html` — "Logbook": paper and ink, one tick per episode
- `DirectionC.dc.html` — "Signal": dark terminal, segmented bars, pace label

Palette: midnight blue surfaces (#0a0d18 / #151a2e), neon city-blue #5ad1ff for all
progress, neon pink #ff5c9d reserved for "next up", violet #7d6cf0 for a finished
season. Type and layout are unchanged from the first round.

Show titles, episode names and artwork are placeholders — no show data source
is wired up yet.
