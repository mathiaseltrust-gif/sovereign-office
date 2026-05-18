import { Router } from "express";
import { db } from "@workspace/db";
import { familyUnitsTable } from "@workspace/db";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/family-units", requireAuth, async (req, res, next) => {
  try {
    const familyUnits = await db
      .select({
        id:               familyUnitsTable.id,
        gedcomFamId:      familyUnitsTable.gedcomFamId,
        husbandId:        familyUnitsTable.husbandId,
        wifeId:           familyUnitsTable.wifeId,
        spouseIds:        familyUnitsTable.spouseIds,
        childIds:         familyUnitsTable.childIds,
        relationshipType: familyUnitsTable.relationshipType,
        sourceType:       familyUnitsTable.sourceType,
      })
      .from(familyUnitsTable);
    res.json({ familyUnits });
  } catch (err) {
    next(err);
  }
});

export default router;
