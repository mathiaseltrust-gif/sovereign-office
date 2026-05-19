import { Router } from "express";

const router = Router();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const UA = "MathiasElTribe/1.0 (contact@mathiaseltribe.org)";

// GET /api/geocode/search?q=...
router.get("/search", async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) return res.status(400).json({ error: "Missing q parameter" });

    const url = `${NOMINATIM_BASE}/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
    });
    if (!r.ok) return res.status(502).json({ error: "Nominatim search failed" });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/geocode/reverse?lat=...&lng=...
router.get("/reverse", async (req, res, next) => {
  try {
    const lat = req.query.lat as string | undefined;
    const lng = req.query.lng as string | undefined;
    if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng parameters" });

    const url = `${NOMINATIM_BASE}/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
    });
    if (!r.ok) return res.status(502).json({ error: "Nominatim reverse geocode failed" });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
