# Member Registry and Claim Workflow Plan

Purpose: protect the tribal member number registry while letting relatives find themselves on the family tree and request linkage to the correct lineage node.

## Canonical member numbers

These numbers are protected and must not be overwritten by automation:

- 001: Mathew Allen McCaster / Chief Mathias El
- 002: Brenda Carolina Vasquez McCaster
- 003: Mathew Jacob McCaster
- 004: Allen Joseph McCaster Jr
- 005: Michael KeJuan McCaster
- 006: Michael Dalton / Mike D
- 007: Donald, reserved and memorialized
- 008: Arlene, reserved and memorialized

The card or badge UI may display these as 01, 02, 03, etc., but the database should preserve 001, 002, 003, etc. for sorting and registry stability.

## Ancestor rule

Ancestors do not receive tribal member numbers unless specifically acknowledged as members by governance action. Ancestors should instead use one of these non-member identifiers:

- ancestor placement number
- lineage archive number
- ancestral registry number
- GEDCOM source reference
- memorial designation

## Allocation rule

A tribal member number is assigned only when a person becomes a confirmed member.

The allocator must:

1. skip protected numbers 001 through 008,
2. skip memorialized or reserved numbers,
3. skip ancestors unless they are specifically confirmed as members,
4. skip hidden/test records,
5. assign the next available number once,
6. never reassign a number that has already been dedicated.

## Member claim workflow

A new relative should be able to search the family tree before creating a duplicate record.

Search inputs:

- legal name
- nickname or alias
- email address
- parent name
- child name
- aunt or uncle name
- cousin name
- known tribal ID suffix
- household link

If a match exists, the person can request linkage to the existing family_lineage record.

Statuses:

- pending
- needs_more_info
- approved
- rejected
- merged
- withdrawn

Officer review actions:

- approve claim
- reject claim
- request more evidence
- merge duplicate lineage records
- link profile user to family_lineage record
- allow claimant to add children or grandchildren as pending descendants

## Immediate examples

- Michael Dalton / Mike D should claim or link to the existing Michael Dalton node.
- Tammy Dean McCaster should claim or link to the existing Tammy Dean McCaster node.
- Michael KeJuan McCaster should show as brother to Mathew Allen McCaster and uncle to Mathew Jacob and Allen Joseph.

## UI destination

Add a Find Myself / Claim My Place flow under lineage onboarding and family tree.

The claim result should show relationship context before the claim is submitted:

- parents
- siblings
- children
- spouse or partner
- aunts and uncles
- cousins
- household members
- source notes
- confidence level
