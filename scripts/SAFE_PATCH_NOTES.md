# Safe Patch Notes

This branch does not reset the database and does not alter Docker routing.

Before merging:
1. Run TypeScript/build checks.
2. Test `/api/intake/classify-and-route` with deed of trust, trust instrument, grant deed, and ancestry records.
3. Run `scripts/inspect-collateral-kin.sql` against production DB to confirm parent sibling data.
4. Add a dedicated Kinship View UI after backend relationship data is verified.
