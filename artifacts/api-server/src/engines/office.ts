import { logger } from "../lib/logger";

export type SovereignModule =
  | "trust-service"
  | "templates"
  | "recorder-engine"
  | "entra"
  | "ai-learning"
  | "trust-land"
  | "state-intel"
  | "classification"
  | "complaints"
  | "calendar"
  | "tasks"
  | "search";

class SovereignOffice {
  private readonly name = "Sovereign Office of the Chief Justice & Trustee";
  private moduleStatus: Map<SovereignModule, "active" | "suspended"> = new Map();

  constructor() {
    const modules: SovereignModule[] = [
      "trust-service",
      "templates",
      "recorder-engine",
      "entra",
      "ai-learning",
      "trust-land",
      "state-intel",
      "classification",
      "complaints",
      "calendar",
      "tasks",
      "search",
    ];
    for (const mod of modules) {
      this.moduleStatus.set(mod, "active");
    }
    logger.info({ authority: this.name }, "Sovereign Office initialized");
  }

  getAuthority(): string {
    return this.name;
  }

  isModuleActive(mod: SovereignModule): boolean {
    return this.moduleStatus.get(mod) === "active";
  }

  suspendModule(mod: SovereignModule): void {
    this.moduleStatus.set(mod, "suspended");
    logger.warn({ module: mod }, "Module suspended by sovereign authority");
  }

  activateModule(mod: SovereignModule): void {
    this.moduleStatus.set(mod, "active");
    logger.info({ module: mod }, "Module activated by sovereign authority");
  }

  getStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    for (const [mod, state] of this.moduleStatus.entries()) {
      status[mod] = state;
    }
    return status;
  }
}

export const sovereignOffice = new SovereignOffice();
