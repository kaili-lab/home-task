import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { and, desc, eq } from "drizzle-orm";
import type { DbInstance } from "../../db/db";
import { messages as messagesTable } from "../../db/schema";
import type { AIResponseType, LastAssistantMessage } from "./types";

type HistoryLogger = (stage: string, details?: Record<string, unknown>) => void;

export class HistoryManager {
  constructor(
    private db: DbInstance,
    private log?: HistoryLogger,
    private toContentPreview?: (content: unknown) => string,
  ) {}

  async loadHistory(userId: number, limit = 20): Promise<BaseMessage[]> {
    const rows = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.userId, userId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    rows.reverse();

    return rows
      .filter((row) => row.role !== "system")
      .map((row) =>
        row.role === "user"
          ? new HumanMessage(row.content)
          : new AIMessage(row.content),
      );
  }

  async loadLastAssistantMessage(userId: number): Promise<LastAssistantMessage | null> {
    const rows = await this.db
      .select({ content: messagesTable.content, type: messagesTable.type })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, userId), eq(messagesTable.role, "assistant")))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  async saveMessage(
    userId: number,
    role: "user" | "assistant",
    content: string,
    type: AIResponseType = "text",
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(messagesTable).values({
      userId,
      role,
      content,
      type,
      payload: payload || null,
    });
    this.log?.("message.saved", {
      userId,
      role,
      type,
      contentPreview: this.toContentPreview?.(content) ?? content,
      hasPayload: !!payload,
    });
  }
}
