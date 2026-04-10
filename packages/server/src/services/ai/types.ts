import type { TaskInfo } from "shared";

export type AIResponseType = "text" | "task_summary" | "question";

export interface AIServiceResult {
  content: string;
  type: AIResponseType;
  payload?: {
    task?: TaskInfo;
    conflictingTasks?: TaskInfo[];
  };
}

export type ToolActionType = "create" | "update" | "complete" | "delete";

export type ToolResultStatus =
  | "success"
  | "conflict"
  | "need_confirmation"
  | "error";

export interface ToolResult {
  status: ToolResultStatus;
  message: string;
  task?: TaskInfo;
  conflictingTasks?: TaskInfo[];
  actionPerformed?: ToolActionType;
  responseType?: AIResponseType;
}

export type TaskIntent =
  | "create"
  | "query"
  | "update"
  | "complete"
  | "delete"
  | null;

export interface LastAssistantMessage {
  content: string;
  type: string;
}
