import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type { GroupInfo, GroupDetail, UserGroup, CreateGroupInput, UpdateGroupInput } from "shared";
import { formatLocalDateTime } from "@/utils/date";

function mapGroupInfoTimes(group: GroupInfo): GroupInfo {
  // 在接口层统一格式化时间，避免组件内各自处理导致展示不一
  const createdAt = formatLocalDateTime(group.createdAt) ?? group.createdAt;
  const updatedAt = formatLocalDateTime(group.updatedAt) ?? group.updatedAt;
  return { ...group, createdAt, updatedAt };
}

function mapGroupDetailTimes(detail: GroupDetail): GroupDetail {
  // 统一成员时间格式，避免列表与详情显示不一致
  return {
    ...mapGroupInfoTimes(detail),
    members: detail.members.map((member) => ({
      ...member,
      joinedAt: formatLocalDateTime(member.joinedAt) ?? member.joinedAt,
    })),
  };
}

function mapUserGroupTimes(group: UserGroup): UserGroup {
  // 保持用户群组列表时间格式一致，避免与群组详情展示差异
  return {
    ...group,
    joinedAt: formatLocalDateTime(group.joinedAt) ?? group.joinedAt,
    createdAt: formatLocalDateTime(group.createdAt) ?? group.createdAt,
  };
}

/**
 * 创建群组
 */
export async function createGroup(data: CreateGroupInput) {
  const response = await apiPost<GroupInfo>("/api/groups", data);
  return mapGroupInfoTimes(response.data);
}

/**
 * 获取我的群组列表
 * 返回 UserGroup[]，包含当前用户在群组中的角色信息
 */
export async function getGroups() {
  const response = await apiGet<{ groups: UserGroup[] }>("/api/groups");
  return response.data.groups.map(mapUserGroupTimes);
}

/**
 * 获取群组详情
 */
export async function getGroupById(id: number) {
  const response = await apiGet<GroupDetail>(`/api/groups/${id}`);
  return mapGroupDetailTimes(response.data);
}

/**
 * 更新群组信息（仅群主�? */
export async function updateGroup(id: number, data: UpdateGroupInput) {
  const response = await apiPatch<GroupInfo>(`/api/groups/${id}`, data);
  return mapGroupInfoTimes(response.data);
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
 * 移除成员或退出群�? * @param groupId - 群组ID
 * @param userId - 用户ID（如果是自己退出，传入当前用户ID�? */
export async function removeMember(groupId: number, userId: number) {
  const response = await apiDelete<{ message: string }>(`/api/groups/${groupId}/members/${userId}`);
  return response.data;
}

/**
 * 退出群组（便捷方法�? */
export async function leaveGroup(groupId: number, userId: number) {
  return removeMember(groupId, userId);
}

/**
 * 解散群组（仅群主�? */
export async function deleteGroup(groupId: number) {
  const response = await apiDelete<{ message: string }>(`/api/groups/${groupId}`);
  return response.data;
}
