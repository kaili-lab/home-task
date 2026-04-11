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

export interface UserMessagePolicy {
  inferredIntent: TaskIntent;
  requireToolCall: boolean;
  skipSemanticConflictCheck: boolean;
}

export type NoToolCallResponseAction =
  | "return_as_is"
  | "correct_with_conflict_context"
  | "correct_with_not_executed_message";

export interface NoToolCallResponsePolicy {
  action: NoToolCallResponseAction;
  content: string;
}

export interface LastAssistantMessage {
  content: string;
  type: string;
}
