import { Router, type Request, type Response } from "express";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { logger } from "../lib/logger";

const router = Router();

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { amountCents, recurring, donorName, donorEmail } = req.body as {
      amountCents?: number;
      recurring?: boolean;
      donorName?: string;
      donorEmail?: string;
    };

    if (!amountCents || typeof amountCents !== "number" || amountCents < 100) {
      res.status(400).json({ error: "Minimum donation is $1.00" });
      return;
    }
    if (amountCents > 100_000_00) {
      res.status(400).json({ error: "Maximum single donation is $100,000" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
    const baseUrl = domains ? `https://${domains}` : "http://localhost:3000";
    const returnBase = `${baseUrl}/sovereign-dashboard/charitable-trust`;

    const mode = recurring ? "subscription" : "payment";

    const priceData: {
      currency: string;
      product_data: { name: string; description: string };
      unit_amount: number;
      recurring?: { interval: "month" };
    } = {
      currency: "usd",
      product_data: {
        name: "Mathias El Tribe Charitable Trust — Donation",
        description: "Tax-deductible charitable contribution. 26 U.S.C. § 501(c)(3) · § 170.",
      },
      unit_amount: amountCents,
    };
    if (recurring) {
      priceData.recurring = { interval: "month" };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode,
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${returnBase}?donated=true&amount=${amountCents}`,
      cancel_url: `${returnBase}`,
      ...(donorEmail ? { customer_email: donorEmail } : {}),
      metadata: {
        type: "charitable_trust_donation",
        donor_name: donorName ?? "Anonymous",
        recurring: recurring ? "true" : "false",
      },
      ...(!recurring
        ? {
            payment_intent_data: {
              description: "Mathias El Tribe Charitable Trust — Tax-Deductible Donation",
            },
          }
        : {}),
    });

    logger.info(
      { amountCents, recurring, sessionId: session.id },
      "Donation checkout session created"
    );
    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Donation checkout error");
    res.status(500).json({ error: msg });
  }
});

router.get("/publishable-key", async (_req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
