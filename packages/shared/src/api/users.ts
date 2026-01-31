// 用户相关类型定义

// 更新用户输入类型
export interface UpdateUserInput {
  name?: string;
  avatar?: string;
  defaultGroupId?: number | null;
}

// 用户信息类型
export interface UserInfo {
  id: number;
  email: string;
  name: string | null; // 用户昵称（显示名称）
  avatar: string | null;
  role: string;
  defaultGroupId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// 用户群组类型
export interface UserGroup {
  id: number;
  name: string;
  inviteCode: string;
  avatar: string | null;
  role: string; // owner | member
  joinedAt: Date;
  createdAt: Date;
  memberCount?: number; // 成员数量（可选，向后兼容）
}
