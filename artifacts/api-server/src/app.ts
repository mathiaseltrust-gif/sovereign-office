import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { entraMiddleware } from "./auth/entra";
import { requireEntraIfRequired } from "./auth/entra-guard";
import { serviceKeyMiddleware } from "./auth/service-key";
import { sovereignOffice } from "./sovereign/office";
import { initBootstrapToken } from "./lib/bootstrap-token";
import { seedDefaultGovernors } from "./sovereign/role-governor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const communityDashboardDist = path.resolve(__dirname, "../../../artifacts/community-dashboard/dist/public");

const app: Express = express();

app.use(compression());

// Stripe webhook — must be registered BEFORE express.json() to receive raw body
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        Array.isArray(sig) ? sig[0] : sig,
        process.env.STRIPE_WEBHOOK_SECRET ?? ""
      );
      logger.info({ type: event.type }, "Stripe webhook received");
      res.json({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Webhook error";
      logger.warn({ err }, "Stripe webhook error");
      res.status(400).json({ error: msg });
    }
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SSE auth: EventSource can't send custom headers, so accept token via query param.
// Scoped narrowly to the SSE endpoint only — URL tokens have higher exposure risk.
app.use("/api/messages/sse", (req: Request, _res: Response, next: NextFunction) => {
  const qAuth = req.query.authorization as string | undefined;
  if (qAuth && !req.headers.authorization) {
    req.headers.authorization = qAuth;
  }
  next();
});

app.use(serviceKeyMiddleware);
app.use(entraMiddleware);
app.use(requireEntraIfRequired);

logger.info({ authority: sovereignOffice.getAuthority() }, "Sovereign authority online");
void initBootstrapToken();
void seedDefaultGovernors();

app.use("/api", router);

app.use("/community-dashboard", express.static(communityDashboardDist, { index: false }));
app.get("/community-dashboard/{*path}", (_req: Request, res: Response) => {
  res.sendFile(path.join(communityDashboardDist, "index.html"));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `File upload error: ${err.message}` });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: message });
});

export default app;
