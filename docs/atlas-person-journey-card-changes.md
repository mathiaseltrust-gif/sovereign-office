# Atlas Person Journey Card — First Pass

Changed file:

- `artifacts/urban-indian-atlas/src/components/PersonContextPanel.tsx`

What changed:

- The right-side person card now treats `ancestor.lifeEvents` as the primary Life Journey source.
- Birth, death, and burial profile anchors are preserved.
- Life events are normalized into a simple timeline with event type, date/year, place, source, and coordinate status.
- Events with coordinates are clickable and call `onEventFocus(coords)`.
- Events with a place but no coordinates are labeled `needs coordinates` and do not create fake map focus points.
- Historical context matches remain visible, but are clearly separated from personal life events.

Not changed yet:

- No DB schema change.
- No Atlas map path rendering change yet.
- No global timeline switch yet.
- No fake fallback coordinates.

Next step:

- Wire `PersonLifeEvent[]` into `AtlasMap` and `AtlasTimeline` so selected-person map/timeline use the same normalized journey data.
