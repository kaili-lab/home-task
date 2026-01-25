import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { AIService } from "../services/ai.service";
import { TaskService } from "../services/task.service";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const aiRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

// AI对话的Zod Schema
const chatSchema = z.object({
  message: z.string().min(1),
  audioUrl: z.string().url().optional(),
});

// 确认任务的Zod Schema
const confirmTaskSchema = z.object({
  confirmed: z.boolean(),
});

/**
 * POST /api/ai/transcribe
 * 语音转文字（Whisper）
 */
aiRoutes.post("/transcribe", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);

    // 获取上传的文件
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json(
        {
          success: false,
          error: "未找到音频文件",
        },
        400
      );
    }

    // 验证文件格式
    const allowedTypes = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/m4a", "audio/webm"];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        {
          success: false,
          error: "不支持的音频格式，支持: mp3, mp4, wav, m4a, webm",
        },
        400
      );
    }

    const taskService = new TaskService(db);
    const apiKey = c.env.AIHUBMIX_API_KEY || c.env.OPENAI_API_KEY || "";
    const baseURL = c.env.AIHUBMIX_API_KEY ? "https://aihubmix.com/v1" : undefined;
    const aiService = new AIService(db, taskService, apiKey, baseURL);
    const result = await aiService.transcribeAudio(userId, file);

    return c.json(successResponse(result));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * POST /api/ai/chat
 * AI对话（支持流式返回）
 */
aiRoutes.post("/chat", zValidator("json", chatSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const { message, audioUrl } = c.req.valid("json");

    // 检查是否请求流式返回
    const stream = c.req.query("stream") === "true";

    const taskService = new TaskService(db);
    const apiKey = c.env.AIHUBMIX_API_KEY || c.env.OPENAI_API_KEY || "";
    const baseURL = c.env.AIHUBMIX_API_KEY ? "https://aihubmix.com/v1" : undefined;
    const aiService = new AIService(db, taskService, apiKey, baseURL);

    if (stream) {
      // 流式返回（Server-Sent Events）
      const response = await aiService.chat(userId, message, audioUrl, true);
      if (response && typeof response[Symbol.asyncIterator] === "function") {
        return c.stream(async (stream) => {
          const encoder = new TextEncoder();
          for await (const chunk of response) {
            await stream.write(encoder.encode(`data: ${JSON.stringify({ type: "message", content: chunk })}\n\n`));
          }
          await stream.write(encoder.encode("data: [DONE]\n\n"));
        }, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    // 完整响应
    const response = await aiService.chat(userId, message, audioUrl, false);
    if (typeof response === "object" && "content" in response) {
      return c.json(successResponse(response));
    }
    return c.json(successResponse({ content: "" }));
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

    // 解析查询参数
    const limitParam = c.req.query("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    const taskService = new TaskService(db);
    const apiKey = c.env.AIHUBMIX_API_KEY || c.env.OPENAI_API_KEY || "";
    const baseURL = c.env.AIHUBMIX_API_KEY ? "https://aihubmix.com/v1" : undefined;
    const aiService = new AIService(db, taskService, apiKey, baseURL);
    const messages = await aiService.getMessages(userId, limit);

    return c.json(successResponse({ messages }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * POST /api/ai/tasks/:id/confirm
 * 确认AI创建的任务
 */
aiRoutes.post("/tasks/:id/confirm", zValidator("json", confirmTaskSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const taskId = parseInt(c.req.param("id"), 10);
    const { confirmed } = c.req.valid("json");

    if (isNaN(taskId)) {
      return c.json(
        {
          success: false,
          error: "无效的任务ID",
        },
        400
      );
    }

    if (!confirmed) {
      return c.json(
        {
          success: false,
          error: "确认操作被取消",
        },
        400
      );
    }

    const taskService = new TaskService(db);
    const apiKey = c.env.AIHUBMIX_API_KEY || c.env.OPENAI_API_KEY || "";
    const baseURL = c.env.AIHUBMIX_API_KEY ? "https://aihubmix.com/v1" : undefined;
    const aiService = new AIService(db, taskService, apiKey, baseURL);
    await aiService.confirmTask(userId, taskId);

    return c.json(successResponse({ message: "任务已确认" }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

export default aiRoutes;
