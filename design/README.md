# Design

Working files for the TV show tracker screen designs.

Each `*.dc.html` file is one artboard (a phone screen, 390x844); `canvas.json`
lays them out on the shared canvas. `tv-show-tracker-screens.html` is the
generated canvas that gets published — it is rebuilt from the artboards, so
edit the artboards, not that file.

## Artboards

Direction A ("Late Night") — the current leading direction, full flow:

- `Main.dc.html` — My Shows: up-next card, per-show progress bars, tap to mark watched
- `ShowDetail.dc.html` — show page: overall progress, per-season bars
- `Episodes.dc.html` — season episode checklist, tap to tick
- `Browse.dc.html` — search / trending / airing tonight

Alternate directions for the My Shows screen:

- `DirectionB.dc.html` — "Logbook": paper and ink, one tick per episode
- `DirectionC.dc.html` — "Signal": dark terminal, segmented bars, pace label

Show titles, episode names and artwork are placeholders — no show data source
is wired up yet.
