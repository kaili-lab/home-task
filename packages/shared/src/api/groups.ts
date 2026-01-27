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
  createdAt: Date;
  updatedAt: Date;
}

// 群组详情类型（包含成员列表）
export interface GroupDetail extends GroupInfo {
  members: Array<{
    userId: number;
    nickname: string | null;
    role: string;
    joinedAt: Date;
  }>;
}
