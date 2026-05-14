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
