import { useAuth } from "./useAuth";
import { mockUsers } from "@/lib/mockData";
import type { User } from "@/types";

/**
 * 获取当前用户信息
 * 使用认证上下文中的用户数据
 */
export function useCurrentUser() {
  const { user } = useAuth();

  // 将 UserInfo 转换为 User 类型（兼容现有代码）
  // name字段存储用户昵称（显示名称）
  const currentUser: User | null = user
    ? {
        id: user.id,
        name: user.name || user.email.split("@")[0], // 显示名称使用name，如果没有则使用email前缀
        email: user.email,
        role: user.role,
        initials: (user.name || user.email[0]).toUpperCase(), // 使用name，如果没有则使用email首字母
        color: "from-orange-400 to-orange-500", // 默认颜色
      }
    : null;

  return {
    currentUser: currentUser || mockUsers[0], // 降级到mock数据
    allUsers: mockUsers, // 暂时保留mock数据
  };
}
