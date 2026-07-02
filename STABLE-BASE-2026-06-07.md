Stable Base — 2026-06-07

Commit:
747fef5 Preserve Docker service routing in production compose

Confirmed healthy:
- /login = 200 OK
- /api/healthz = db ok
- /atlas/ = 200 OK
- /trace/ = 200 OK

Do not globally pin IMAGE_TAG to a commit unless every service image has that tag.
Current safe mode: IMAGE_TAG=latest with docker-compose.prod.yml routing fix committed.

Known application-level items remaining:
- Household view should prioritize self + spouse + children.
- Parent/Pedigree/Fan should center authenticated profile.
- Calendar/test records should remain hidden.
- NFR should be expanded from original Airtable/Softr concept into full module.
