import { Hono } from "hono";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { AIService } from "../services/ai.service";
import { messages as messagesTable } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const aiRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

/**
 * POST /api/ai/chat
 * 发送消息，获取 AI 回复
 */
aiRoutes.post("/chat", async (c) => {
  try {
    const requestId = globalThis.crypto?.randomUUID?.() || `ai_${Date.now()}_${Math.random()}`;
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const { message } = await c.req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return c.json({ success: false, error: "消息不能为空" }, 400);
    }

    const tzOffsetHeader = c.req.header("x-timezone-offset");
    const timezoneOffsetMinutes = tzOffsetHeader ? Number.parseInt(tzOffsetHeader, 10) : 0;
    console.log(
      "[ai.chat]",
      JSON.stringify({
        requestId,
        userId,
        hasMessage: !!message,
        timezoneOffsetMinutes,
      }),
    );
    const aiService = new AIService(
      db,
      c.env,
      Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : 0,
      requestId,
    );
    const result = await aiService.chat(userId, message.trim());

    return c.json(successResponse(result));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/ai/messages
 * 获取对话历史
 */
aiRoutes.get("/messages", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const limitParam = c.req.query("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10), 1), 100);

    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.userId, userId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    // 反转为时间正序
    rows.reverse();

    const messages = rows
      .filter((row) => row.role !== "system")
      .map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        type: row.type,
        payload: row.payload,
        createdAt: row.createdAt,
      }));

    return c.json(successResponse({ messages }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

export default aiRoutes;
