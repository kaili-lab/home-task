import { apiGet, apiPatch } from "@/lib/api-client";
import type { UserInfo, UserGroup, UpdateUserInput } from "shared";
import { formatLocalDateTime } from "@/utils/date";

function mapUserInfoTimes(user: UserInfo): UserInfo {
  // 在接口层统一格式化时间，避免多个页面展示不一致
  const createdAt = formatLocalDateTime(user.createdAt) ?? user.createdAt;
  const updatedAt = formatLocalDateTime(user.updatedAt) ?? user.updatedAt;
  return { ...user, createdAt, updatedAt };
}

function mapUserGroupTimes(group: UserGroup): UserGroup {
  // 统一群组时间格式，避免列表与详情显示差异
  return {
    ...group,
    joinedAt: formatLocalDateTime(group.joinedAt) ?? group.joinedAt,
    createdAt: formatLocalDateTime(group.createdAt) ?? group.createdAt,
  };
}

/**
 * 获取当前登录用户信息
 */
export async function getCurrentUser() {
  const response = await apiGet<UserInfo>("/api/users/me");
  return mapUserInfoTimes(response.data);
}

/**
 * 更新当前用户信息
 */
export async function updateCurrentUser(data: UpdateUserInput) {
  const response = await apiPatch<UserInfo>("/api/users/me", data);
  return mapUserInfoTimes(response.data);
}

/**
 * 获取当前用户所在的所有群组列�? */
export async function getUserGroups() {
  const response = await apiGet<{ groups: UserGroup[] }>("/api/users/me/groups");
  return response.data.groups.map(mapUserGroupTimes);
}
