---
name: Atlas↔Tree sync
description: How Family Tree links to Atlas to show a selected ancestor's movements
---

**Rule:** To navigate from the Family Tree detail panel to the Atlas focused on a specific ancestor, link to `/urban-indian-atlas/?person=<id>&mode=atlas`.

**Why:** Atlas already reads URL params on mount (useEffect at load). `?person=N` sets `selectedPersonId` and `?mode=atlas` activates Atlas Mode. Both trigger the ancestor data fetch and auto-select the person on the map. No additional cross-app messaging, sessionStorage, or shared context needed.

**How to apply:** Any Tree→Atlas "View in Atlas" button should use this URL pattern. The Atlas PersonContextPanel will highlight the matching ancestor and filter the context matches panel to that person's events.
