import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { resolveSovereignIdentityGateway } from "../../sovereign/identity-gateway";

const router = Router();

router.get("/gateway", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const tokenUser = {
      email: req.user!.email,
      name: req.user!.name ?? req.user!.email,
      roles: req.user!.roles ?? [],
    };
    const payload = await resolveSovereignIdentityGateway(dbId, tokenUser);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
