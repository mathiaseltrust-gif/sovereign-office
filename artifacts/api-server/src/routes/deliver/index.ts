import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { getUncachableStripeClient } from "../../stripeClient";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      fileNumber,
      documentTitle,
      recipientName,
      recipientAddress,
    } = req.body as {
      fileNumber?: string;
      documentTitle?: string;
      recipientName?: string;
      recipientAddress?: string;
    };

    if (!recipientName?.trim() || !recipientAddress?.trim()) {
      res.status(400).json({ error: "Recipient name and mailing address are required." });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
    const baseUrl = domains ? `https://${domains}` : "http://localhost:3000";
    const returnBase = `${baseUrl}/sovereign-dashboard/sovereign-pipeline`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Mathias El Tribe — Official Seal & Send Service",
              description:
                "Certified mail with tracking, official tribal seal applied, and proof of service record. " +
                "Proceeds support the Mathias El Tribe Charitable Trust for the general welfare of the People.",
            },
            unit_amount: 5000,
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBase}?delivery=sent&file=${encodeURIComponent(fileNumber ?? "")}&recipient=${encodeURIComponent(recipientName ?? "")}`,
      cancel_url: `${returnBase}?delivery=cancelled`,
      metadata: {
        type: "document_delivery_service",
        file_number: fileNumber ?? "",
        document_title: documentTitle ?? "",
        recipient_name: recipientName ?? "",
        recipient_address: recipientAddress ?? "",
      },
      payment_intent_data: {
        description: `Official Seal & Send — ${fileNumber ?? "Document"} → ${recipientName}`,
      },
    });

    logger.info(
      { fileNumber, recipientName, sessionId: session.id },
      "Document delivery checkout session created"
    );

    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Document delivery checkout error");
    res.status(500).json({ error: msg });
  }
});

export default router;
