import { runAiEngine } from "./ai-engine";
import { logger } from "../lib/logger";

interface IntakePipelineOptions {
  text: string;
  userId?: number;
  context?: {
    caseType?: string;
    actorType?: string;
    landStatus?: string;
    actionType?: string;
    childInvolved?: boolean;
    tribe?: string;
    court?: string;
    role?: string;
  };
  logContext?: Record<string, unknown>;
}

interface IntakePipelineResult {
  report: Awaited<ReturnType<typeof runAiEngine>>;
  meta: {
    tier: string | undefined;
    tierReason: string | undefined;
    azureAvailable: boolean | undefined;
  };
}

export async function processIntake(opts: IntakePipelineOptions): Promise<IntakePipelineResult> {
  const { text, userId, context, logContext = {} } = opts;
  logger.info({ userId, textLen: text.length, ...logContext }, "AI intake engine request received");
  const report = await runAiEngine({ text, userId, context });
  const r = report as unknown as Record<string, unknown>;
  return {
    report,
    meta: {
      tier: r.tier as string | undefined,
      tierReason: r.tierReason as string | undefined,
      azureAvailable: r.azureAvailable as boolean | undefined,
    },
  };
}
