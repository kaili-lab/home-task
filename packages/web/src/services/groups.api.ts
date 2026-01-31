import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  GroupInfo,
  GroupDetail,
  UserGroup,
  CreateGroupInput,
  UpdateGroupInput,
} from "shared";

/**
 * 创建群组
 */
export async function createGroup(data: CreateGroupInput) {
  const response = await apiPost<GroupInfo>("/api/groups", data);
  return response.data;
}

/**
 * 获取我的群组列表
 * 返回 UserGroup[]，包含当前用户在群组中的角色信息
 */
export async function getGroups() {
  const response = await apiGet<{ groups: UserGroup[] }>("/api/groups");
  return response.data.groups;
}

/**
 * 获取群组详情
 */
export async function getGroupById(id: number) {
  const response = await apiGet<GroupDetail>(`/api/groups/${id}`);
  return response.data;
}

/**
 * 更新群组信息（仅群主）
 */
export async function updateGroup(id: number, data: UpdateGroupInput) {
  const response = await apiPatch<GroupInfo>(`/api/groups/${id}`, data);
  return response.data;
}

/**
 * 通过邀请码加入群组
 */
export async function joinGroup(inviteCode: string) {
  const response = await apiPost<{
    groupId: number;
    groupName: string;
    role: string;
  }>("/api/groups/join", { inviteCode });
  return response.data;
}

/**
 * 移除成员或退出群组
 * @param groupId - 群组ID
 * @param userId - 用户ID（如果是自己退出，传入当前用户ID）
 */
export async function removeMember(groupId: number, userId: number) {
  const response = await apiDelete<{ message: string }>(
    `/api/groups/${groupId}/members/${userId}`
  );
  return response.data;
}

/**
 * 退出群组（便捷方法）
 */
export async function leaveGroup(groupId: number, userId: number) {
  return removeMember(groupId, userId);
}

/**
 * 解散群组（仅群主）
 */
export async function deleteGroup(groupId: number) {
  const response = await apiDelete<{ message: string }>(`/api/groups/${groupId}`);
  return response.data;
}
