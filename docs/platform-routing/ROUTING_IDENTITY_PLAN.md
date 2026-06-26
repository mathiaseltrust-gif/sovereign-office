# Platform Routing and Identity Plan

## Principle
Subdomains and path routes are entry points into the same Sovereign Office platform, not separate identity systems.

## Entry Points
- office.mathiaseltribe.org
- office.mathiaseltribe.org/atlas
- atlas.mathiaseltribe.org
- trust.mathiaseltribe.org
- community.mathiaseltribe.org
- authority.mathiaseltribe.org
- member.mathiaseltribe.org

## Rule
All entry points must resolve the same authenticated identity, profile, member, and linked genealogy person where available.

## Desired Identity Chain
Login -> Session -> Profile -> Member/Beneficiary -> Family Person -> Atlas Person Journey

## Atlas Rule
Atlas does not own authentication. Atlas consumes the platform session and resolves:
- userId
- profileId
- memberId
- personId
- roles
- permissions

## Routing Rule
Subdomain access and path access must land on the same module state.
