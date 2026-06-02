# People Platform

Isolated starter folder for the future `people.mathiaseltribe.org` application.

This folder is separate from the current dashboard code so experimental work can continue without disrupting existing modules.

## Current purpose

- Hold the standalone harmonizer draft.
- Keep profile-view code separate from existing dashboard routes.
- Provide a safe place for future people-facing pages.

## Isolation rule

Existing dashboard, TRACE, NFR, land, and lineage modules should not import this folder unless intentionally wired later.

## Proposed route namespace

```txt
/people/api/harmonizer/profile/me
/people/api/harmonizer/profile/:profileId
```

## Initial folders

```txt
people-platform/
  README.md
  harmonizer/
  app/
  db/
  docs/
```
