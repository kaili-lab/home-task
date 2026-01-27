import { apiGet, apiPatch } from "@/lib/api-client";
import type {
  UserInfo,
  UserGroup,
  UpdateUserInput,
} from "shared";

/**
 * 获取当前登录用户信息
 */
export async function getCurrentUser() {
  const response = await apiGet<UserInfo>("/api/users/me");
  return response.data;
}

/**
 * 更新当前用户信息
 */
export async function updateCurrentUser(data: UpdateUserInput) {
  const response = await apiPatch<UserInfo>("/api/users/me", data);
  return response.data;
}

/**
 * 获取当前用户所在的所有群组列表
 */
export async function getUserGroups() {
  const response = await apiGet<{ groups: UserGroup[] }>("/api/users/me/groups");
  return response.data.groups;
}
