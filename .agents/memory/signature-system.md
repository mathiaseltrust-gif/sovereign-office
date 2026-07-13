---
name: Signature system architecture
description: How the sovereign signature system works — where images are stored, how they flow into documents, and the two-slot pattern.
---

## The rule
`profiles.signatureUrl` (a base64 data URL, stored via `POST /api/identity/signature`) is the **single source of truth** for all officer signature images. Every document type must pull from this, not from a parallel table.

**Why:** A separate `office_signatures` table (object-storage based) was built but is now legacy. The profile-based system was the original design and is what the Tribal ID card already displays.

## How to apply
- `GET /api/identity/signatures/officer` — returns all profiles with signatureUrl set, enriched with user name. Use this to offer signature choices in any document UI.
- `loadSignaturesFromProfiles(assignments)` in `certificates/index.ts` — converts base64 data URL → Buffer for PDFKit embedding.
- Frontend: `SignatureSelector.tsx` component — two-slot panel (chief_justice + trustee), auto-loads from the officer endpoint, returns `SlotAssignment[]` with signatureUrl for HTML print embedding.

## Two-column print pattern (matches pdf-builder.ts)
Every printed document uses a two-column signature block:
- **Left**: Electronic Sig — Judicial & Official Capacity (Chief Justice & Trustee)
- **Right**: Electronic Sig — Legal Name / In Propria Persona
- Signature image embedded above rule line (base64 data URL in `<img>` for HTML, Buffer for PDFKit)
- Wet signature line below each column

## Activation mechanism
The "listener" the user refers to is governor activation (`POST /governors/:id/activate`). When a governor is activated, their `signatureBlockTemplate` flows into court documents via `court-doc-generator.ts`. The profile signatureUrl flows into HTML/PDF documents via SignatureSelector selection.
