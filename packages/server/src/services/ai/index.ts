import type { Bindings } from "../../types/bindings";
import type { DbInstance } from "../../db/db";
import { AgentLoop } from "./agent-loop";
import { HistoryManager } from "./history-manager";
import { PromptBuilder } from "./prompt-builder";
import { HallucinationGuard } from "./hallucination-guard";
import { ConflictDetector } from "./conflict-detector";
import { ToolExecutor } from "./tool-executor";
import type { AIServiceResult } from "./types";

export class AIService {
  private agentLoop: AgentLoop;

  constructor(
    db: DbInstance,
    env: Bindings,
    timezoneOffsetMinutes: number = 0,
    requestId: string = `ai_${Date.now()}_${Math.random()}`,
  ) {
    const promptBuilder = new PromptBuilder(db, timezoneOffsetMinutes);
    const historyManager = new HistoryManager(
      db,
      (stage, details) => this.agentLoop?.debugLog(stage, details),
      (content) => this.agentLoop?.toContentPreview(content) ?? String(content ?? ""),
    );
    const conflictDetector = new ConflictDetector(db);
    const hallucinationGuard = new HallucinationGuard(promptBuilder);
    const toolExecutor = new ToolExecutor(
      db,
      promptBuilder,
      conflictDetector,
      (stage, details) => this.agentLoop?.debugLog(stage, details),
      (value, maxLength) => this.agentLoop?.toJsonPreview(value, maxLength) ?? "",
    );

    this.agentLoop = new AgentLoop(
      env,
      requestId,
      historyManager,
      promptBuilder,
      hallucinationGuard,
      toolExecutor,
    );
  }

  async chat(userId: number, message: string): Promise<AIServiceResult> {
    return this.agentLoop.chat(userId, message);
  }
}

export type { AIServiceResult } from "./types";
