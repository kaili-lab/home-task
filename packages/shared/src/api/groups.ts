// 群组相关类型定义

// 创建群组输入类型
export interface CreateGroupInput {
  name: string;
  avatar?: string;
}

// 更新群组输入类型
export interface UpdateGroupInput {
  name?: string;
  avatar?: string;
}

// 群组信息类型
export interface GroupInfo {
  id: number;
  name: string;
  inviteCode: string;
  avatar: string | null;
  // 统一返回 UTC 字符串，避免 Date 在不同时区序列化产生歧义
  createdAt: string;
  // 统一返回 UTC 字符串，避免 Date 在不同时区序列化产生歧义
  updatedAt: string;
}

// 群组详情类型（包含成员列表）
export interface GroupDetail extends GroupInfo {
  members: Array<{
    userId: number;
    name: string | null;
    role: string;
    // 统一返回 UTC 字符串，避免 Date 在不同时区序列化产生歧义
    joinedAt: string;
  }>;
}
