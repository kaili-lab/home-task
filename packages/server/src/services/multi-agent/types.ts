import type { TaskInfo } from "shared";

// 统一结果结构是为多 Agent 间传递一致语义，避免各工具各说各话
export type ToolResultStatus = "success" | "conflict" | "need_confirmation" | "error";

// 显式区分动作类型，便于上层根据执行意图进行渲染与统计
export type ToolActionType = "create" | "update" | "complete" | "delete";

// 统一的 Tool 返回结构，确保后续解析 payload 时有稳定字段
export interface ToolResult {
  status: ToolResultStatus;
  message: string; // 给 LLM 阅读的文本摘要，方便模型生成用户回复
  task?: TaskInfo; // 返回任务实体以支持前端摘要展示
  conflictingTasks?: TaskInfo[]; // 冲突列表用于生成确认问题
  actionPerformed?: ToolActionType; // 明确实际执行的动作，避免推断
  data?: Record<string, unknown>; // 预留扩展字段，避免频繁修改接口
}

// 多 Agent 服务对外返回类型（兼容现有 AIServiceResult / AIChatResponse）
export interface MultiAgentServiceResult {
  content: string;
  type: "text" | "task_summary" | "question"; // 显式类型便于前端确定展示形态
  payload?: {
    task?: TaskInfo;
    conflictingTasks?: TaskInfo[];
  };
}

// graph invoke 时注入的运行时上下文，避免工具依赖全局单例
export interface AgentConfigurable {
  db: import("../../db/db").DbInstance;
  userId: number;
  timezoneOffsetMinutes: number;
}
