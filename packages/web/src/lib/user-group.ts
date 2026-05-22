import type { Group } from "@/types";
import type { UserGroup } from "shared";

/** 将 API 的 UserGroup 转为前端 Group（纯数据映射，无 React 依赖） */
export function userGroupToGroup(userGroup: UserGroup): Group {
  const createdAt = userGroup.createdAt || undefined;
  return {
    id: userGroup.id,
    name: userGroup.name,
    inviteCode: userGroup.inviteCode,
    avatar: userGroup.avatar,
    role: userGroup.role,
    icon: userGroup.avatar || "🏠",
    memberCount: userGroup.memberCount || 1,
    createdAt,
    updatedAt: undefined,
  };
}
