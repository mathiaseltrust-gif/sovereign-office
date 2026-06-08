# Document Intelligence Router — Implementation Plan

Purpose: when a scanned/uploaded document enters the Office, classify it, extract structured facts, link it to the correct person/parcel/trust/case, preserve evidence, and trigger review engines when needed.

Document subtypes to support:
- deed_of_trust
- trust_instrument
- trust_declaration
- grant_deed
- correction_deed
- quitclaim_deed
- mortgage_security_instrument
- notice_of_default
- foreclosure_notice
- tax_lien
- recorder_notice
- tribal_court_order
- protective_order
- identity_document
- ancestry_record
- household_record
- court_document
- nfr_notice
- other_unknown

Required deed/trust fields:
- apn, atn, parcelId, propertyAddress, legalDescription
- recordingNumber, recordingDate, instrumentNumber, county
- grantor, grantee, borrower/trustor, trustee, beneficiary/lender, servicer
- documentTitle, executionDate, notaryDate, trustName, trustRole
- lienIndicators, encumbranceIndicators

Routing:
- deed_of_trust -> land_parcel + encumbrance + trust/case evidence + NFR trigger
- trust_instrument/trust_declaration -> trust_instrument + trust dashboard + evidence
- grant_deed/correction_deed/quitclaim_deed -> land_parcel + title chain + evidence
- notice_of_default/foreclosure_notice -> land_parcel + encumbrance + NFR trigger + calendar deadline
- tax_lien -> land_parcel + encumbrance + NFR trigger
- recorder_notice -> land_parcel + recorder review + NFR trigger
- ancestry_record/household_record -> lineage import/review
- identity_document -> profile vault

Safety rule: do not overwrite final records automatically. Store extracted facts as pending review if confidence or matching is uncertain.
